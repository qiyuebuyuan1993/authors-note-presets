import { chatKey, pickFields, readNotes, scopes, writeNotes } from './author-note.js';

const KEY = 'authors-note-presets';
const LABEL = '作者注释快照';
const OPEN_COMMAND = 'authors-note-presets-open';
const QUICK_REPLY_INSTALLED = KEY + '-quick-reply-installed';
const SCOPE_IDS = Object.keys(scopes);

async function installQuickReply(context) {
    const api = globalThis.quickReplyApi;
    if (!api || context.extensionSettings[QUICK_REPLY_INSTALLED] === true) {
        return;
    }

    const message = '/' + OPEN_COMMAND;
    const title = '打开' + LABEL;
    const names = api.listSets();
    let setName = names.find(name => api.getSetByName(name).qrList.some(reply =>
        reply.message === message && reply.title === title,
    ));

    if (!setName) {
        setName = LABEL;
        for (let suffix = 2; names.includes(setName); suffix++) {
            setName = `${LABEL} (${suffix})`;
        }
        const set = await api.createSet(setName, { disableSend: false, injectInput: false });
        api.createQuickReply(setName, LABEL, { message, title });
        await set.save();
    }

    if (!api.listGlobalSets().includes(setName)) {
        api.addGlobalSet(setName);
    }
    context.extensionSettings[QUICK_REPLY_INSTALLED] = true;
    context.saveSettingsDebounced();
}

function savedNotes(snapshot) {
    return snapshot.notes ?? { chat: { text: snapshot.text } };
}

function describe(snapshot) {
    const notes = savedNotes(snapshot);
    const parts = SCOPE_IDS.filter(scope => notes[scope]).map(scope => scopes[scope]);
    const settings = notes.chat ?? notes.defaults;
    if (settings?.position === 1 && settings.depth !== undefined) {
        parts.push('深度 ' + settings.depth);
    }
    return parts.join(' · ');
}

function mount(tavern) {
    if (document.getElementById('an-snapshots') || !document.getElementById('extension_floating_prompt')) {
        return;
    }

    const getContext = () => tavern.getContext();
    const dialog = document.createElement('dialog');
    dialog.id = 'an-snapshots';
    dialog.setAttribute('aria-labelledby', 'an-title');
    dialog.innerHTML = `
        <div class="an-window">
            <header class="an-header">
                <h2 id="an-title">${LABEL}</h2>
                <button type="button" class="menu_button an-close" data-close aria-label="关闭作者注释快照">×</button>
            </header>
            <div class="an-toolbar">
                <button type="button" class="menu_button an-primary" data-new autofocus>保存当前快照</button>
                <button type="button" class="menu_button" data-clear>清空当前聊天注释</button>
            </div>
            <div class="an-scroll">
                <p class="an-target" data-target></p>
                <form class="an-editor" hidden>
                    <label for="an-name">快照名称</label>
                    <input id="an-name" type="text" class="text_pole" required>
                    <div class="an-fields"></div>
                    <div class="an-actions">
                        <button type="submit" class="menu_button an-primary" data-save>保存快照</button>
                        <button type="button" class="menu_button" data-discard>取消编辑</button>
                        <button type="button" class="menu_button" data-delete hidden>删除快照</button>
                    </div>
                </form>
                <p class="an-empty" data-empty>还没有快照。</p>
                <ul class="an-list" aria-label="已保存的作者注释快照"></ul>
            </div>
            <footer class="an-footer">
                <span role="status"></span>
                <button type="button" class="menu_button" data-undo disabled>撤销</button>
            </footer>
        </div>`;
    document.body.append(dialog);

    const list = dialog.querySelector('.an-list');
    const editor = dialog.querySelector('form');
    const name = editor.querySelector('#an-name');
    const fields = editor.querySelector('.an-fields');
    const create = dialog.querySelector('[data-new]');
    const clear = dialog.querySelector('[data-clear]');
    const undo = dialog.querySelector('[data-undo]');
    const remove = editor.querySelector('[data-delete]');
    const status = dialog.querySelector('[role="status"]');
    const target = dialog.querySelector('[data-target]');
    let readyChat = chatKey(getContext());
    let launcher;
    let draft;
    let lastChange;
    let rows = [];

    function state() {
        const context = getContext();
        return { context, notes: readNotes(context, readyChat) };
    }

    function presets() {
        const saved = getContext().extensionSettings[KEY];
        return Array.isArray(saved) ? saved : [];
    }

    function savePresets(entries) {
        const context = getContext();
        context.extensionSettings[KEY] = entries;
        context.saveSettingsDebounced();
    }

    function availableUndo({ context, notes }) {
        if (lastChange?.target === chatKey(context)
            && JSON.stringify(pickFields(notes, lastChange.after)) === JSON.stringify(lastChange.after)) {
            return lastChange;
        }

        const legacy = context.chatMetadata?.[KEY];
        if (notes.chat && typeof legacy?.previous === 'string' && notes.chat.text === legacy.applied) {
            return { before: { chat: { text: legacy.previous } }, legacy: true };
        }
        return null;
    }

    function refresh() {
        const current = state();
        const { context, notes } = current;
        const character = context.characters?.[context.characterId]?.name;
        if (notes.character) {
            target.textContent = '人物项写入当前角色' + (character ? '「' + character + '」' : '') + '。';
        } else {
            target.textContent = notes.chat ? '可载入当前聊天与默认项。' : '打开聊天后可使用当前聊天与人物项。';
        }
        clear.disabled = !notes.chat?.text;
        undo.disabled = !availableUndo(current);
        for (const { button, snapshot } of rows) {
            button.disabled = !Object.keys(pickFields(savedNotes(snapshot), notes)).length;
        }
    }

    function apply(values, message) {
        const { context, notes } = state();
        if (chatKey(context) !== readyChat && (values.chat || values.character)) {
            status.textContent = '聊天正在切换，请稍后载入。';
            refresh();
            return;
        }
        const patch = pickFields(values, notes);
        if (!Object.keys(patch).length) {
            refresh();
            return;
        }
        const before = pickFields(notes, patch);
        if (JSON.stringify(before) === JSON.stringify(patch)) {
            status.textContent = '当前作者注释已与快照一致。';
            refresh();
            return;
        }

        if (patch.chat?.text !== undefined && patch.chat.text !== before.chat.text) {
            delete context.chatMetadata[KEY];
        }
        writeNotes(context, patch);
        const after = pickFields(readNotes(context, readyChat), patch);
        lastChange = { target: chatKey(context), before, after };
        status.textContent = message + (values.character && !patch.character ? ' 人物项请在单聊中载入。' : '');
        refresh();
    }

    function renderList() {
        rows = [];
        list.replaceChildren();
        for (const snapshot of presets()) {
            if (typeof snapshot?.name !== 'string') {
                continue;
            }
            const row = document.createElement('li');
            const load = document.createElement('button');
            load.type = 'button';
            load.className = 'an-entry';
            load.setAttribute('aria-label', '载入快照 ' + snapshot.name);
            const title = document.createElement('span');
            title.className = 'an-name';
            title.textContent = snapshot.name;
            title.title = snapshot.name;
            const detail = document.createElement('small');
            detail.textContent = describe(snapshot);
            const loadLabel = document.createElement('span');
            loadLabel.className = 'an-load-label';
            loadLabel.textContent = '载入';
            load.append(title, detail, loadLabel);
            load.addEventListener('click', () => apply(savedNotes(snapshot), '已载入「' + snapshot.name + '」。'));
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'menu_button';
            edit.textContent = '编辑';
            edit.setAttribute('aria-label', '编辑快照 ' + snapshot.name);
            edit.addEventListener('click', () => openEditor(snapshot, edit));
            row.append(load, edit);
            list.append(row);
            rows.push({ button: load, snapshot });
        }
        dialog.querySelector('[data-empty]').hidden = rows.length > 0;
        refresh();
    }

    function openEditor(snapshot, origin) {
        if (!editor.hidden) {
            name.focus();
            return;
        }
        const notes = snapshot ? savedNotes(snapshot) : state().notes;
        const inputs = {};
        fields.replaceChildren();
        for (const scope of SCOPE_IDS) {
            if (!notes[scope]) {
                continue;
            }
            const label = document.createElement('label');
            const caption = document.createElement('span');
            caption.textContent = scopes[scope];
            const input = snapshot ? document.createElement('textarea') : document.createElement('input');
            if (snapshot) {
                label.className = 'an-text-field';
                input.className = 'text_pole';
                input.rows = 3;
                input.value = notes[scope].text ?? '';
                label.append(caption, input);
            } else {
                label.className = 'checkbox_label';
                input.type = 'checkbox';
                input.checked = true;
                label.append(input, caption);
            }
            fields.append(label);
            inputs[scope] = input;
        }
        if (!snapshot) {
            const hint = document.createElement('small');
            hint.textContent = '当前聊天包含世界信息扫描开关。默认项用于新聊天。';
            fields.append(hint);
        }

        draft = { snapshot, notes, inputs, origin };
        name.value = snapshot?.name ?? '';
        editor.querySelector('[data-save]').textContent = snapshot ? '保存更改' : '保存快照';
        remove.hidden = !snapshot;
        remove.textContent = '删除快照';
        remove.dataset.confirm = '';
        editor.hidden = false;
        status.textContent = '';
        name.focus();
    }

    function closeEditor() {
        const origin = draft.origin;
        draft = null;
        editor.hidden = true;
        (origin.isConnected ? origin : create).focus();
    }

    editor.addEventListener('submit', event => {
        event.preventDefault();
        const title = name.value.trim();
        if (!title) {
            status.textContent = '请输入快照名称。';
            name.focus();
            return;
        }
        const { snapshot, inputs, notes } = draft;
        const captured = {};
        for (const [scope, input] of Object.entries(inputs)) {
            if (snapshot) {
                captured[scope] = { ...notes[scope], text: input.value };
            } else if (input.checked) {
                captured[scope] = notes[scope];
            }
        }
        if (!Object.keys(captured).length) {
            status.textContent = '请选择至少一个保存范围。';
            return;
        }
        const value = { name: title, notes: captured };
        const entries = presets();
        savePresets(snapshot ? entries.map(entry => entry === snapshot ? value : entry) : [...entries, value]);
        renderList();
        closeEditor();
        status.textContent = '已保存「' + title + '」。';
    });

    create.addEventListener('click', () => openEditor(null, create));
    editor.querySelector('[data-discard]').addEventListener('click', () => {
        closeEditor();
        status.textContent = '';
    });
    remove.addEventListener('click', () => {
        const snapshot = draft.snapshot;
        if (!remove.dataset.confirm) {
            remove.dataset.confirm = 'true';
            remove.textContent = '确认删除';
            status.textContent = '再次点击以删除「' + snapshot.name + '」。';
            return;
        }
        savePresets(presets().filter(entry => entry !== snapshot));
        renderList();
        closeEditor();
        status.textContent = '已删除「' + snapshot.name + '」。';
    });

    clear.addEventListener('click', () => apply({ chat: { text: '' } }, '已清空当前聊天的作者注释。'));
    undo.addEventListener('click', () => {
        const current = state();
        const change = availableUndo(current);
        if (!change) {
            refresh();
            return;
        }
        if (change.legacy) {
            delete current.context.chatMetadata[KEY];
        }
        writeNotes(current.context, change.before);
        lastChange = null;
        status.textContent = '已恢复操作前的作者注释。';
        refresh();
    });

    function show(button = document.activeElement) {
        if (dialog.open) {
            return;
        }
        launcher = button;
        refresh();
        dialog.showModal();
        if (draft) {
            name.focus();
        }
    }

    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) {
            dialog.close();
        }
    });
    dialog.addEventListener('close', () => {
        (launcher?.offsetParent ? launcher : document.getElementById('extensionsMenuButton'))?.focus();
    });

    const wand = document.getElementById('extensionsMenu');
    if (wand) {
        const item = document.createElement('div');
        item.id = 'an-snapshot-wand';
        item.className = 'list-group-item flex-container flexGap5';
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-haspopup', 'dialog');
        const icon = document.createElement('div');
        icon.className = 'fa-solid fa-note-sticky extensionsMenuExtensionButton';
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = LABEL;
        item.append(icon, label);
        item.addEventListener('click', () => show(item));
        item.addEventListener('keydown', event => {
            if (event.key === ' ') {
                event.preventDefault();
            }
            if (event.key === 'Enter' && !event.repeat) {
                event.preventDefault();
                item.click();
            }
        });
        item.addEventListener('keyup', event => {
            if (event.key === ' ') {
                event.preventDefault();
                item.click();
            }
        });
        wand.append(item);
    }

    const { eventSource, eventTypes } = getContext();
    eventSource.makeLast(eventTypes.CHAT_CHANGED, () => {
        readyChat = chatKey(getContext());
        refresh();
    });
    renderList();

    const { SlashCommandParser, SlashCommand } = getContext();
    if (SlashCommandParser?.addCommandObject && SlashCommand?.fromProps && !SlashCommandParser.commands?.[OPEN_COMMAND]) {
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: OPEN_COMMAND,
            helpString: '打开作者注释快照窗口。',
            callback: () => {
                show();
                return '';
            },
        }));
        void installQuickReply(getContext()).catch(error => {
            console.warn('[作者注释快照] 无法自动添加快速回复按钮', error);
        });
    }
}

const tavern = globalThis.SillyTavern ?? globalThis.Luker;
if (tavern?.getContext) {
    const { eventSource, eventTypes } = tavern.getContext();
    eventSource.on(eventTypes.APP_READY, () => mount(tavern));
}

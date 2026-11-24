const KEY = 'authors-note-presets';

function mount() {
    const note = document.querySelector('#extension_floating_prompt');
    const tavern = globalThis.SillyTavern ?? globalThis.Luker;
    if (!note || !tavern?.getContext || document.getElementById(KEY)) {
        return;
    }

    const getContext = () => tavern.getContext();
    const panel = document.createElement('section');
    panel.id = KEY;
    panel.setAttribute('aria-labelledby', 'an-presets-title');
    panel.innerHTML = `
        <header class="an-presets-toolbar">
            <b id="an-presets-title">作者注释预设</b>
            <button type="button" class="menu_button" data-new>新建预设</button>
            <button type="button" class="menu_button" data-undo disabled>取消填入</button>
        </header>
        <ul class="an-presets-list" aria-labelledby="an-presets-title"></ul>
        <form class="an-presets-editor" hidden>
            <label for="an-presets-name">预设名称</label>
            <input id="an-presets-name" class="text_pole" type="text" required>
            <label for="an-presets-text">注释内容</label>
            <textarea id="an-presets-text" class="text_pole" rows="4" required></textarea>
            <div class="an-presets-actions">
                <button type="submit" class="menu_button">保存预设</button>
                <button type="button" class="menu_button" data-close>取消编辑</button>
                <button type="button" class="menu_button" data-delete hidden>删除预设</button>
            </div>
        </form>
        <small class="an-presets-status" role="status"></small>
    `;
    note.before(panel);

    const list = panel.querySelector('ul');
    const editor = panel.querySelector('form');
    const name = panel.querySelector('#an-presets-name');
    const content = panel.querySelector('#an-presets-text');
    const create = panel.querySelector('[data-new]');
    const undo = panel.querySelector('[data-undo]');
    const remove = panel.querySelector('[data-delete]');
    const status = panel.querySelector('[role="status"]');
    let activeChat = {};
    let editing;
    let returnFocus;
    let confirmingDelete = false;

    function presets() {
        const saved = getContext().extensionSettings[KEY];
        return Array.isArray(saved) ? saved : [];
    }

    function savePresets(entries) {
        const context = getContext();
        context.extensionSettings[KEY] = entries;
        context.saveSettingsDebounced();
    }

    function chatMetadata() {
        const { chatId, characterId, groupId, chatMetadata } = getContext();
        // A client can change its selected chat before the new note has loaded.
        if (chatId == null || chatId === '' || chatId !== activeChat.chatId
            || characterId !== activeChat.characterId || groupId !== activeChat.groupId) {
            return null;
        }
        return chatMetadata;
    }

    function currentUndo(metadata) {
        const record = metadata?.[KEY];
        return record?.applied === note.value && typeof record.previous === 'string' ? record : null;
    }

    function refreshControls() {
        const metadata = chatMetadata();
        undo.disabled = !currentUndo(metadata);
        for (const fill of list.querySelectorAll('.an-presets-fill')) {
            fill.disabled = !metadata;
        }
    }

    function syncChat() {
        const { chatId, characterId, groupId } = getContext();
        activeChat = { chatId, characterId, groupId };
        status.textContent = chatMetadata() ? '' : '打开聊天后即可填入预设。';
        refreshControls();
    }

    function publishNote() {
        // Let the native note handler update the prompt, token count, and chat save.
        note.dispatchEvent(new Event('input', { bubbles: true }));
        refreshControls();
    }

    function apply(preset) {
        const metadata = chatMetadata();
        if (!metadata) {
            return;
        }
        if (note.value === preset.text) {
            status.textContent = `当前注释与「${preset.name}」相同。`;
            return;
        }
        const previous = currentUndo(metadata)?.previous ?? note.value;
        note.value = preset.text;
        metadata[KEY] = { previous, applied: note.value };
        publishNote();
        status.textContent = `当前聊天已填入「${preset.name}」。`;
    }

    function rowButton(label, preset) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu_button';
        button.textContent = label;
        button.setAttribute('aria-label', `${label} ${preset.name}`);
        return button;
    }

    function renderList() {
        list.replaceChildren();
        for (const preset of presets()) {
            const row = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = preset.name;
            label.title = preset.name;
            const fill = rowButton('填入', preset);
            fill.classList.add('an-presets-fill');
            fill.addEventListener('click', () => apply(preset));
            const edit = rowButton('编辑', preset);
            edit.addEventListener('click', () => openEditor(preset, edit));
            row.append(label, fill, edit);
            list.append(row);
        }
        refreshControls();
    }

    function openEditor(preset, button) {
        if (editor.hidden) {
            editing = preset;
            returnFocus = button;
            name.value = preset?.name ?? '';
            content.value = preset?.text ?? (chatMetadata() ? note.value : '');
            confirmingDelete = false;
            remove.textContent = '删除预设';
            remove.hidden = !preset;
            editor.hidden = false;
            status.textContent = '';
        }
        name.focus();
    }

    function closeEditor() {
        editor.hidden = true;
        editing = null;
        (returnFocus.isConnected ? returnFocus : create).focus();
    }

    create.addEventListener('click', () => openEditor(null, create));
    panel.querySelector('[data-close]').addEventListener('click', () => {
        status.textContent = '';
        closeEditor();
    });
    editor.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!name.value.trim() || !content.value.trim()) {
            status.textContent = '请输入预设名称和注释内容。';
            (name.value.trim() ? content : name).focus();
            return;
        }
        const preset = { name: name.value.trim(), text: content.value };
        const entries = presets();
        savePresets(editing ? entries.map(entry => entry === editing ? preset : entry) : [...entries, preset]);
        renderList();
        closeEditor();
        status.textContent = `已保存「${preset.name}」。`;
    });
    remove.addEventListener('click', () => {
        if (!confirmingDelete) {
            confirmingDelete = true;
            remove.textContent = '确认删除';
            status.textContent = `再次点击以删除预设「${editing.name}」。`;
            return;
        }
        const removed = editing.name;
        savePresets(presets().filter(entry => entry !== editing));
        renderList();
        closeEditor();
        status.textContent = `已删除预设「${removed}」。`;
    });
    undo.addEventListener('click', () => {
        const metadata = chatMetadata();
        const record = currentUndo(metadata);
        if (!record) {
            return;
        }
        delete metadata[KEY];
        note.value = record.previous;
        publishNote();
        status.textContent = record.previous ? '已恢复填入前的注释。' : '已清空当前聊天的作者注释。';
    });

    // Also handle the synthetic input event used by the built-in /note command.
    globalThis.$(note).on('input.anTextPresets', () => {
        const metadata = chatMetadata();
        if (metadata?.[KEY] && !currentUndo(metadata)) {
            delete metadata[KEY];
            status.textContent = '注释已改动。';
        }
        refreshControls();
    });
    const { eventSource, eventTypes } = getContext();
    eventSource.on(eventTypes.APP_READY, () => {
        // SillyTavern can load third-party extensions before it wires the note drawer.
        eventSource.makeLast(eventTypes.CHAT_CHANGED, syncChat);
        syncChat();
    });
    renderList();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
    mount();
}

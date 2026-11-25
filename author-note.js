export const scopes = {
    chat: '当前聊天',
    character: '人物作者注',
    defaults: '默认作者注',
};

const chatFields = {
    text: 'note_prompt',
    position: 'note_position',
    depth: 'note_depth',
    role: 'note_role',
    interval: 'note_interval',
};

const defaultFields = {
    text: 'default',
    position: 'defaultPosition',
    depth: 'defaultDepth',
    role: 'defaultRole',
    interval: 'defaultInterval',
};

const nativeDefaults = { text: '', position: 1, depth: 4, role: 0, interval: 1 };

export function chatKey(context) {
    const { chatId, groupId, characterId } = context;
    return chatId == null || chatId === '' ? null : JSON.stringify([groupId, characterId, chatId]);
}

function characterKey(context) {
    if (!context.groupId) {
        return context.characters?.[context.characterId]?.avatar?.replace(/\.[^/.]+$/, '') ?? null;
    }
    return null;
}

function readFields(source, fields, fallback) {
    const values = {};
    for (const [key, property] of Object.entries(fields)) {
        const value = source[property] ?? fallback[key];
        const number = Number(value);
        if (key === 'text') {
            values[key] = String(value);
        } else {
            values[key] = Number.isFinite(number) ? number : fallback[key];
        }
    }
    return values;
}

function writeFields(target, fields, values) {
    for (const [key, property] of Object.entries(fields)) {
        if (Object.hasOwn(values, key)) {
            target[property] = values[key];
        }
    }
}

function readCharacter(entry) {
    return {
        text: entry?.prompt ?? '',
        enabled: Boolean(entry?.useChara),
        position: Number(entry?.position) || 0,
    };
}

export function readNotes(context, readyChat) {
    const note = context.extensionSettings.note;
    const defaults = readFields(note, defaultFields, nativeDefaults);
    if (readyChat === null || readyChat !== chatKey(context)) {
        return { defaults };
    }

    const chat = {
        ...readFields(context.chatMetadata, chatFields, defaults),
        scanWorldInfo: Boolean(note.allowWIScan),
    };
    const character = characterKey(context);
    const notes = { chat, defaults };
    if (character) {
        notes.character = readCharacter(note.chara?.find(entry => entry.name === character));
    }
    return notes;
}

// Pick supported fields from a saved snapshot or read back just the fields an action touched.
export function pickFields(values, shape) {
    const result = {};
    for (const scope of Object.keys(scopes)) {
        if (!values?.[scope] || !shape?.[scope]) {
            continue;
        }
        const fields = {};
        for (const [key, expected] of Object.entries(shape[scope])) {
            const value = values[scope][key];
            if (Object.hasOwn(values[scope], key) && typeof value === typeof expected
                && (typeof value !== 'number' || Number.isFinite(value))) {
                fields[key] = value;
            }
        }
        if (Object.keys(fields).length) {
            result[scope] = fields;
        }
    }
    return result;
}

function replaceCharacterNote(settings, key, patch) {
    const entries = settings.chara ??= [];
    const index = entries.findIndex(entry => entry.name === key);
    const note = { ...readCharacter(entries[index]), ...patch };

    if (!note.text && !note.enabled && note.position === 0) {
        if (index >= 0) {
            entries.splice(index, 1);
        }
        return;
    }

    const values = { name: key, prompt: note.text, useChara: note.enabled, position: note.position };
    if (index >= 0) {
        Object.assign(entries[index], values);
    } else {
        entries.push(values);
    }
}

function notifyText(input, text) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function writeNotes(context, patch) {
    const settings = context.extensionSettings.note;
    if (patch.defaults) {
        writeFields(settings, defaultFields, patch.defaults);
    }
    if (patch.character) {
        replaceCharacterNote(settings, characterKey(context), patch.character);
    }
    if (patch.chat) {
        writeFields(context.chatMetadata, chatFields, patch.chat);
        if (Object.hasOwn(patch.chat, 'scanWorldInfo')) {
            settings.allowWIScan = patch.chat.scanWorldInfo;
        }
    }

    // Update the model before notifying the native controls, which refresh the
    // panel, rebuild its injection prompt, and schedule the host's saves.
    if (patch.chat) {
        notifyText(document.getElementById('extension_floating_prompt'), context.chatMetadata.note_prompt ?? '');
    }
    if (patch.defaults || (patch.character && !patch.chat)) {
        notifyText(document.getElementById('extension_floating_default'), settings.default ?? '');
    }
    if (patch.character) {
        const input = document.getElementById('extension_floating_chara');
        const counter = document.getElementById('extension_floating_chara_token_counter');
        const text = input.value;
        Promise.resolve(context.getTokenCountAsync(text)).then(count => {
            if (input.value === text && counter) {
                counter.textContent = String(count);
            }
        }).catch(error => console.debug('Author note token count unavailable', error));
    }
}

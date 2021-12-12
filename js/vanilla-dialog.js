// Create vanilla Javascript dialogs that can use jQuery UI syntax
HTMLElement.prototype.dialog = function(arg1, arg2, arg3) {
    if (typeof this._dialogArgs == 'undefined') {
        this._dialogArgs = {};
    }

    if (!this._dialogInstantiated) {
        //this.prop('tabindex', -1);
        this._dialogArgs.prevFocusElement = null;

        if (document.querySelectorAll('#dialog-background').length === 0) { // This is the first dialog call
            document.body.insertAdjacentHTML('beforeend', '<div id="dialog-background"></div>');
            //document.body.insertAdjacentHTML('beforeend', '<a id="dialog-background-close-button" href="#" title="close" draggable="false">X</a>');

            document.querySelectorAll('#dialog-background-close-button').forEach(b => { b.addEventListener('click', function(event) {
                event.preventDefault();
                document.querySelectorAll('div.dialog.open-dialog').forEach(e => { e.dialog('close'); });
            });});

            document.querySelectorAll('#dialog-background-close-button').forEach(b => { b.addEventListener('keydown', function(event) {
                if (event.which == 27) {
                    event.preventDefault();
                    document.querySelectorAll('div.dialog.open-dialog').forEach(e => { e.dialog('close'); });
                } else if (event.which == 9 && !event.shiftKey) {
                    event.preventDefault();
                }
            });});

            document.body.addEventListener('keydown', function(event) {
                const openDialogs = document.querySelectorAll('.dialog.open-dialog');

                if (event.which == 9 && openDialogs.length > 0) { // Tab
                    const tabbable = Array.from(openDialogs[openDialogs.length - 1].querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                    if (document.querySelector('#dialog-background-close-button')) {
                        tabbable.push(document.querySelector('#dialog-background-close-button'));
                    }

                    let focusWithinDialog = false;
                    for (let i = 0; i < tabbable.length; i ++) {
                        if (tabbable[i] === document.activeElement) {
                            focusWithinDialog = true;

                            if (event.shiftKey && i === 0) {
                                event.preventDefault();
                            } else if (!event.shiftKey && i === tabbable.length - 1) {
                                event.preventDefault();
                            }
                        }
                    }

                    if (!focusWithinDialog) {
                        event.preventDefault();
                        tabbable[0].focus();
                    }
                } else if (event.which == 27 && openDialogs.length > 0) { // ESC
                    event.preventDefault();
                    openDialogs[openDialogs.length - 1].dialog('close');
                }
            });
        }

        this._dialogInstantiated = true;
    }

    if (!this._dialogArgs.title && this.getAttribute('title')) {
        this._dialogArgs.title = this.getAttribute('title');
        this.setAttribute('title', '');
    }

    if (arg1 == 'open') {
        if (document.activeElement) {
            this._dialogArgs.prevFocusElement = document.activeElement;
            this._dialogArgs.prevFocusElement.blur();
        } else {
            this._dialogArgs.prevFocusElement = null;
        }

        if (typeof this._dialogArgs.open == 'function') {
            this._dialogArgs.open();
        }

        if (this._dialogArgs.title) {
            this.setAttribute('data-dialog-title', this._dialogArgs.title);
            this.classList.add('include-dialog-title');
        } else {
            this.classList.remove('include-dialog-title');
        }

        if (this.scrollHeight >= window.innerHeight - 200) {
            this.classList.add('full-height-dialog');
            //this.scrollTop = 0;
        } else {
        }

        document.querySelectorAll('#dialog-background, #dialog-background-close-button').forEach(e => { e.style.display = 'block'; });
        this.classList.add('open-dialog');
        document.documentElement.style.overflow = 'hidden'; // Remove background scrolling
        document.body.style.overflow = 'hidden';

        //this.find(focusableElementSelector).eq(0).focus();
    } else if (arg1 == 'close') {
        if (typeof this._dialogArgs.close == 'function') {
            this._dialogArgs.close();
        }

        this.classList.remove('open-dialog', 'full-height-dialog');
        document.querySelectorAll('#dialog-background, #dialog-background-close-button').forEach(e => { e.style.display = 'none'; });

        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';

        if (this._dialogArgs.prevFocusElement) {
            this._dialogArgs.prevFocusElement.focus();
            this._dialogArgs.prevFocusElement = null;
        }
    } else if (arg1 == 'option' && arg2) {
        this._dialogArgs[arg2] = arg3;
    } else if (typeof arg1 == 'object') {
        for (const key in arg1) {
            this._dialogArgs[key] = arg1[key];
        }
    }

    return this;
};

{
    // Note touchscreen for dialog styles
    const touchListener = function() {
        document.body.classList.add('touchscreen');
        document.removeEventListener('touchstart', touchListener);
    }

    document.addEventListener('touchstart', touchListener);
}

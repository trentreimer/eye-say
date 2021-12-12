function showConsole(show = true) {
    if (show) {
        document.body.insertAdjacentHTML('beforeend', '<div id="console"></div>');

        console.stdLog = console.log.bind(console);
        console.logs = [];
        console.log = function() {
            console.stdLog.apply(console, arguments);
            const args = [...arguments];
            const output = [];

            args.forEach(arg => {
                let text;
                switch(typeof arg) {
                    case 'object':
                        text = JSON.stringify(arg, null, 2);
                        break;
                    case 'undefined':
                        text = 'undefined';
                        break;
                    default:
                        text = arg.toString();
                }

                output.push(text);
            });

            const pre = document.createElement('pre');
            pre.textContent = output.join("\n");
            document.getElementById('console').appendChild(pre);
            pre.scrollIntoView();
        }

        console.stdError = console.error.bind(console);
        console.errors = [];
        console.error = function() {
            console.stdError.apply(console, arguments);
            const args = [...arguments];
            const output = [];

            args.forEach(arg => {
                let text;
                switch(typeof arg) {
                    case 'object':
                        text = JSON.stringify(arg, null, 2);
                        break;
                    case 'undefined':
                        text = 'undefined';
                        break;
                    default:
                        text = arg.toString();
                }

                output.push(text);
            });

            const pre = document.createElement('pre');
            pre.textContent = output.join("\n");
            pre.className = 'error';
            document.getElementById('console').appendChild(pre);
            pre.scrollIntoView();
        }

        window.addEventListener('error', function(event) {
            //const lineNum = event.lineno;
            //const msg = event.message + '  (line ' + lineNum + ')';
            const msg = event.message;
            console.error(msg);
        });
    }
}

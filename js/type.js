{
    // Message area
    const message = document.querySelector('#message');

    const showMessage = (html = null) => {
        if (html !== null) message.innerHTML = html;
        message.classList.remove('hidden');
    };

    const hideMessage = () => {
        message.classList.add('hidden');
    };

    /////////////////////////////////////////////////////////////
    // You need a camera
    let hasVideoDevice = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        window.location.href = 'index.html';
    }

    navigator.mediaDevices.enumerateDevices().then(devices => {
        devices.forEach(device => {
            if (device.kind === 'videoinput') hasVideoDevice = true;
        });

        if (!hasVideoDevice) {
            window.location.href = 'index.html';
        }
    });
    /////////////////////////////////////////////////////////////

    message.classList.add('middle');
    showMessage('<span class="blink">Loading eye-tracker...</span>');

    window.addEventListener('load', function() {
        //hideMessage(); setUpEyeMsg(false); return; // Just show the layout for development purposes

        webgazer.showPredictionPoints(false);
        webgazer.showFaceOverlay(false);
        webgazer.removeMouseEventListeners();
        webgazer.saveDataAcrossSessions(false);
        webgazer.begin();

        webgazer.setGazeListener(function() {
            webgazer.clearGazeListener();
            console.log('webgazer is ready');

            // webgazer is a heavy load. The system needs a little breather before proceeding.
            setTimeout(function() {
                calibrateWebgazer(function() { startEyeMsg(); }); 
            }, 1500);
        });
    });

    // Calibrate buttons
    message.addEventListener('click', event => {
        const calibrateButton = event.target.closest('.run-calibrate');

        if (calibrateButton) {
            calibrateWebgazer();
        }
    });

    /////////////////////////////////////////////////////////////////////
    // Calibration

    let numCalibrationClicks = 5;
    let calibrationClickNum = 0;
    //const calibrationZones = ['middle-left', 'middle-right'];
    const calibrationZones = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    //const calibrationZones = ['top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left', 'top-left'];
    let calibrationZoneIndex = 0;
    let calibrationTargetMoveTime = 2000; // Time it takes target to move from one position to another in milliseconds
    let calibrationTargetClickTime = 3000; // Time to dwell on one spot and fire clicks

    const calibrationTarget = document.querySelector('#calibration-target');
    const calibrationBackground = document.querySelector('#calibration-background');

    let calibrationCallbackFunction;
    let calibrationPrecheckStart = null;

    const calibrationPrecheck = function() {
        const c = document.getElementById('webgazerVideoContainer');
        const b = document.getElementById('webgazerFaceFeedbackBox');

        const now = performance.now();

        if (c && b && b.style && b.style.borderColor && b.style.borderColor == 'green') {
            hideMessage();
            setTimeout(() => { startCalibration(); }, 0);
            calibrationPrecheckStart = null;
        } else {
            if (b && b.style && b.style.borderColor) {
                if (calibrationPrecheckStart === null) calibrationPrecheckStart = now;

                if (calibrationPrecheckStart <= now - 2000) {
                    showMessage('Make sure the camera can see your eyes');
                    if (b.style.borderColor == 'red') c.classList.add('error');
                }
            }

            setTimeout(() => { calibrationPrecheck() }, 1000);
        }
    }

    const calibrateWebgazer = function(callbackFunction = null) {
        calibrationCallbackFunction = callbackFunction;

        setTimeout(function() {
            webgazer.clearGazeListener();
            webgazer.clearData();
        }, 0);

        calibrationClickNum = 0;
        calibrationZoneIndex = -1; // Set to -1 to calibrate the centre position too.

        calibrationTarget.className = 'hidden';
        calibrationTarget.style.setProperty('--transition-time', calibrationTargetMoveTime + 'ms');

        calibrationBackground.classList.remove('hidden');
        document.querySelector('#message').classList.add('middle');

        calibrationPrecheck();
        //startCalibration();
    }

    const startCalibration = function() {
        document.getElementById('webgazerVideoContainer').classList.remove('error');

        showMessage('Watch the dot');

        // Show the calibration dot
        setTimeout(() => {
            hideMessage();
            calibrationTarget.className = message.classList.contains('middle') ? '' : 'top-center';
            //calibrationTarget.className = 'top-center';
            //document.querySelector('#message').classList.remove('middle');

            // Move the calibration dot to the first "click" point
            setTimeout(() => {
                if (calibrationZoneIndex == -1) {
                    clickCalibrationTarget();
                } else {
                    calibrationTarget.className = calibrationZones[calibrationZoneIndex];
                    setTimeout(clickCalibrationTarget, calibrationTargetMoveTime + 500);
                }
            }, 1000);
        }, 2000);
    }

    const clickCalibrationTarget = function() {
        calibrationTarget.classList.add('calibrating');

        if (calibrationClickNum < numCalibrationClicks) {
            // Fire a "click"
            const bounds = calibrationTarget.getBoundingClientRect();
            const x = bounds.left + (bounds.width / 2);
            const y = bounds.top + (bounds.height / 2);

            webgazer.recordScreenPosition(x, y, 'click');

            calibrationClickNum ++;
            setTimeout(clickCalibrationTarget, Math.floor(calibrationTargetClickTime / numCalibrationClicks));
        } else {
            if (calibrationZoneIndex < calibrationZones.length - 1) {
                calibrationZoneIndex ++;
                calibrationClickNum = 0;
                calibrationTarget.className = calibrationZones[calibrationZoneIndex];

                setTimeout(clickCalibrationTarget, calibrationTargetMoveTime + 500);
            } else {
                // done
                calibrationTarget.className = 'hidden';
                calibrationBackground.classList.add('hidden');
                showMessage('Thank you!');

                sessionStorage.setItem('calibrated', Math.round(Date.now() / 1000));

                setTimeout(function() {
                    hideMessage();
                    document.querySelector('#message').classList.remove('middle');
                }, 1000);

                if (typeof calibrationCallbackFunction === 'function') {
                    setTimeout(function() { calibrationCallbackFunction(); }, 1500);
                }
            }
        }
    }
    /////////////////////////////////////////////////////////////////////


    ///////////////////////////////////////////////////////////////
    // Set character pause for rotation based typing (milliseconds)
    let charRotationPause = parseInt(localStorage.getItem('charRotationPause')) >= 1000 ? parseInt(localStorage.getItem('charRotationPause')) : 1500;
    ///////////////////////////////////////////////////////////////


    //////////////////////////////////////////////////////////////
    // Section based typing
    let eyeMsgCharsetIndex = 0;
    let eyeMsgCharIndex = 0;
    let eyeMsgInterval = null;
    let eyeMsgSelectMode = 'charset';
    let eyeMsgCharRotationNum = 0;
    let eyeMsgPaused = false;
    let eyePosition, eyePositionStartTime, eyeCursorMove;

    let eyeMsgChars;

    const eyeMsgKeys = [
        ['A', 'B', 'C', 'D', 'E', 'F'],
        ['G', 'H', 'I', 'J', 'K', 'L'],
        ['M', 'N', 'O', 'P', 'Q', 'R'],
        ['S', 'T', 'U', 'V', 'W', 'X'],
        ['Y', 'Z', '?', '.', ',', '\'', '!'],
        ['_', '⌫', '↵', '<i class="fas fa-pause" data-character="Pause"></i>', '<i class="fas fa-trash" data-character="Empty"></i>', '🛑'],
    ];

    // Hard-set the height so contents can scroll
    const setEyeMsgTextBoxHeight = function() {
        const m = document.getElementById('eye-msg-text');
        const t = m.textContent;

        m.textContent = '';
        m.style.height = 'calc(100% - 20px)'; // Revert to the original percentage based height;

        const h = m.getBoundingClientRect().height;

        m.style.height = h + 'px';
        m.textContent = t;
    }

    window.addEventListener('resize', function() {
        setEyeMsgTextBoxHeight();
    });

    const setUpEyeMsg = function(proceed = true) {
        try { webgazer.clearGazeListener(); } catch (error) { console.log(error); }
        try { clearInterval(eyeMsgInterval); } catch (error) { console.log(error); }

        eyeMsgCharsetIndex = 0;
        eyeMsgCharIndex = 0;
        eyeMsgSelectMode = 'charset';
        eyeMsgCharRotationNum = 0;
        eyeMsgInterval = null;

        eyeMsgChars = [];
        for (const charset of eyeMsgKeys) eyeMsgChars.push(charset);

        let html = '';
        const u = document.createElement('div');

        for (let i = 0; i < eyeMsgChars.length; i ++) {
            html += '<div class="eye-msg-charset">';
            eyeMsgChars[i].forEach(val => {
                u.innerHTML = val;
                const e = u.firstChild;
                html += '<span data-character="' + (typeof e.getAttribute === 'function' && e.getAttribute('data-character') ? e.getAttribute('data-character') : val) + '">' + val + '</span>';
            });
            html += '</div>';
        }

        document.querySelector('.eye-msg-charsets').innerHTML = html;
        u.remove();
        //console.log(html);

        setEyeMsgTextBoxHeight();

        setTimeout(function() {
            document.querySelector('#eye-msg-background').classList.remove('clear');
        }, 0);

        if (proceed) eyeMsgInterval = setInterval(() => { setEyeMsgFocus(); }, charRotationPause);
    }

    ///////////////////////////////////////////
    // Menu listeners
    document.querySelector('#eye-msg-menu .interval').value = Math.round(charRotationPause / 100) / 10;

    document.querySelector('#eye-msg-menu .interval').addEventListener('change', function() {
        charRotationPause = this.value * 1000;
        localStorage.setItem('charRotationPause', charRotationPause);

        // If the rotation is going make sure it uses the new setting.
        if (document.querySelector('#eye-msg-menu .start-stop[data-action="stop"]')) {
            startEyeMsg();
        }
    });

    document.querySelectorAll('#eye-msg-menu .quit').forEach(e => { e.addEventListener('click', function() {
        window.location.href = 'index.html';
    })});

    document.querySelectorAll('#eye-msg-menu .recalibrate').forEach(e => { e.addEventListener('click', function() {
        webgazer.clearGazeListener();
        clearInterval(eyeMsgInterval);
        document.querySelectorAll('.eye-msg-charsets .highlight').forEach(e => { e.classList.remove('highlight'); });

        calibrateWebgazer(function() {
            eyeMsgCharsetIndex = 0;
            eyeMsgCharIndex = 0;
            eyeMsgSelectMode = 'charset';
            webgazer.setGazeListener(eyeFollower);
            eyeMsgInterval = setInterval(setEyeMsgFocus, charRotationPause);
        });
    })});

    document.querySelectorAll('#eye-msg-menu .start-stop').forEach(e => {
        e.addEventListener('click', function() {
            const a = this.getAttribute('data-action');

            if (a === 'stop') {
                stopEyeMsg();
            } else {
                startEyeMsg();
            }
        });
    });

    document.querySelectorAll('#eye-msg-background .copy-text').forEach(e => {
        e.addEventListener('click', function() {
            const m = document.getElementById('eye-msg-text');
            const r = document.createRange();
            const s = window.getSelection();

            r.selectNodeContents(m);
            s.removeAllRanges();
            s.addRange(r);

            navigator.clipboard.writeText(m.textContent.trim());
        });
    });
    ///////////////////////////////////////////

    const startEyeMsg = function() {
        hideMessage();
        setUpEyeMsg();
        webgazer.setGazeListener(eyeFollower);

        document.querySelectorAll('#eye-msg-menu .start-stop').forEach(e => { e.setAttribute('data-action', 'stop'); });
    }

    const hideEyeMsg = function() {
        if (eyeMsgInterval) {
            clearInterval(eyeMsgInterval);
            eyeMsgInterval = null;
        }

        try { webgazer.clearGazeListener(); } catch (error) {};
        document.querySelectorAll('#eye-msg-background, #eye-msg-select').forEach(e => { e.remove(); });
    }

    const stopEyeMsg = function() {
        try { 
            clearInterval(eyeMsgInterval);
        
            document.querySelectorAll('.eye-msg-charsets .highlight').forEach(ee => { ee.classList.remove('highlight'); });
            document.querySelectorAll('#eye-msg-menu .start-stop').forEach(e => { e.setAttribute('data-action', 'start'); });
            document.querySelectorAll('.eye-msg-charsets [data-character="🛑"], .eye-msg-charsets [data-character="Stop"], .eye-msg-charsets [data-character="Done"]').forEach(e => { e.classList.add('highlight'); }); 

            webgazer.clearGazeListener();
        } catch (error) {
            console.log(error);
        }
    }

    const setEyeMsgFocus = function() {
        document.querySelectorAll('.eye-msg-charsets .highlight').forEach(e => { e.classList.remove('highlight'); });

        const charsets = document.querySelectorAll('.eye-msg-charset');
        
        if (eyeMsgCharsetIndex >= charsets.length) {
            eyeMsgCharsetIndex = 0;
        } else if (eyeMsgCharsetIndex === charsets.length - 1 && eyeMsgSelectMode === 'charset') { // In the last row go straight to the characters
            eyeMsgCharIndex = 0;
            eyeMsgCharRotationNum = 0;
            eyeMsgSelectMode = 'char';
        }

        if (eyeMsgSelectMode === 'charset') {
            charsets[eyeMsgCharsetIndex].classList.add('highlight');
            eyeMsgCharsetIndex ++;

            eyeMsgCharIndex = 0;
            eyeMsgCharRotationNum = 0;
        } else { // character
            const chars = charsets[eyeMsgCharsetIndex].querySelectorAll('span');
            
            if (eyeMsgCharIndex >= chars.length) {
                eyeMsgCharIndex = 0;
                eyeMsgCharRotationNum ++;

                if (eyeMsgCharRotationNum > 0) { // Revert to row selection
                    eyeMsgSelectMode = 'charset';
                    eyeMsgCharsetIndex = 0;
                    return;
                }
            }

            chars[eyeMsgCharIndex].classList.add('highlight');
            eyeMsgCharIndex ++;
        }
    }

    const selectEyeMsgValue = function() {
        if (eyeDialogOpen) {
            return selectEyeDialogValue();
        }

        const highlighted = document.querySelector('.eye-msg-charsets .highlight');

        if (highlighted) {
            highlighted.classList.remove('highlight');
            clearInterval(eyeMsgInterval);
            eyeMsgInterval = null;

            const c = highlighted.getAttribute('data-character');//highlighted.textContent;

            if (['Pause', '⏸', '⏯︎'].includes(c)) {
                if (['Pause', '⏸', '⏯︎'].includes(c)) {
                    highlighted.classList.add('highlight');
                    eyeMsgPaused = true;

                    eyeMsgSelectMode = 'charset';
                    eyeMsgCharsetIndex = 0;
                }

                return;
            } else if (['Stop', 'Done', '🛑'].includes(c)) {
                //highlighted.classList.add('highlight');
                
                // Fire the dialog
                eyeDialog('stop-dialog');
                return;
            } else if (['Clear', 'Reset', 'Empty', 'NewMsg', '🗑'].includes(c)) {
                eyeDialog('empty-dialog');
                return;
            }

            if (eyeMsgSelectMode === 'charset') {
                eyeMsgSelectMode = 'char';
                eyeMsgCharIndex = 0;
                eyeMsgCharsetIndex = eyeMsgCharsetIndex - 1;
                if (eyeMsgCharsetIndex < 0) eyeMsgCharsetIndex = document.querySelectorAll('.eye-msg-charset').length - 1;
            } else { // Character select mode
                const m = document.getElementById('eye-msg-text');

                if (['⌫', '«', '<'].includes(c)) {
                    m.textContent = m.textContent.replace(/.$/, '');
                } else if (['_', '␣'].includes(c)) {
                    m.textContent += ' ';
                } else if (['Clear', 'Reset', 'Empty', 'NewMsg', '🗑'].includes(c)) {
                    m.textContent = '';
                } else if (['↵'].includes(c)) {
                    m.textContent += "\n\n";
                } else {
                    m.textContent += c;
                    if (['.', '?', ',', '!'].includes(c)) m.textContent += ' ';
                }

                m.scrollTop = m.scrollHeight;

                eyeMsgSelectMode = 'charset';
                eyeMsgCharsetIndex = 0;
            }

        }

        eyeMsgInterval = setInterval(setEyeMsgFocus, charRotationPause);
    }

    const eyeFollower = function(data, clock) {
        if (!data) return;

        let pos;

        // Set the right-side / left-side demarcator
        let rightSide;
        {
            const rect = document.getElementById('eye-msg-space').getBoundingClientRect();

            if (rect.width < window.innerWidth) {
                rightSide = rect.right * 0.85;
            } else {
                rightSide = rect.right * 0.75;
            }
        }

        if (data.x < rightSide) {
            pos = 'left';
        } else {
            pos = 'right';
        }

        if (pos === 'right') {
            document.getElementById('eye-msg-select').classList.add('viewed');
        } else {
            document.getElementById('eye-msg-select').classList.remove('viewed');
        }

        // Times are in milliseconds
        const positionWait = 200; 
        const unpauseWait = 500;

        if (pos !== eyePosition) {
            eyePositionStartTime = clock;
            eyePosition = pos;
        } else if (['right', 'left'].includes(pos) && clock - eyePositionStartTime > positionWait) {
            if (pos === 'right') {
                clearInterval(eyeMsgInterval);
                eyeMsgInterval = null;
                eyeCursorMove = 'right';
            } else if (pos === 'left' && eyeCursorMove === 'right') {
                eyeCursorMove = null;

                if (eyeMsgPaused) {
                    eyeMsgPaused = false;
                    document.querySelectorAll('.eye-msg-charsets .highlight').forEach(e => { e.classList.remove('highlight'); });
                    eyeMsgInterval = setInterval(setEyeMsgFocus, charRotationPause);
                    return;
                } else {
                    selectEyeMsgValue();
                }
            }
        }
    }

    ///////////////////////////////////////////////////////////////
    // Eye controlled dialogs
    let eyeDialogOpen = false;
    let eyeDialogOptions;
    let eyeDialogOptionIndex = 0;
    let eyeDialogRotationNum = 0;
    let eyeDialogDefaultAction;

    const eyeDialog = function(dialogId, readingTimeout = 1000, defaultAction = 'resume') {
        const d = document.getElementById(dialogId);

        if (d && !eyeDialogOpen) {
            eyeDialogOpen = true;
            clearInterval(eyeMsgInterval);

            document.querySelector('#eye-msg-panel').appendChild(d);

            eyeDialogOptions = d.querySelectorAll('.eye-dialog-option');
            eyeDialogOptionIndex = 0;
            eyeDialogRotationNum = 1;
            eyeDialogDefaultAction = defaultAction;

            if (eyeDialogOptions.length > 0) {
                setTimeout(function() {
                    eyeMsgInterval = setInterval(function() {
                        setEyeDialogFocus();
                    }, charRotationPause + 500);
                }, readingTimeout);
            }
        }

        return null;
    }

    const setEyeDialogFocus = function() {
        eyeDialogOptions.forEach(e => {
            e.classList.remove('highlight');
        });

        if (eyeDialogOptionIndex >= eyeDialogOptions.length) {
            eyeDialogRotationNum ++;
            eyeDialogOptionIndex = 0;

            if (eyeDialogRotationNum > 2) { // After two rotations through the options just fire the default action.
                eyeDialogAction(eyeDialogDefaultAction);
                return;
            }
        }

        eyeDialogOptions[eyeDialogOptionIndex].classList.add('highlight');
        eyeDialogOptionIndex ++;
    }

    const selectEyeDialogValue = function() {
        const highlighted = document.querySelector('#eye-msg-panel .eye-dialog-option.highlight');

        if (highlighted) {
            const action = typeof highlighted.getAttribute === 'function' && highlighted.getAttribute('data-action') ? highlighted.getAttribute('data-action') : null;
            eyeDialogAction(action);
        }
    }

    const eyeDialogAction = function(action = 'resume') {
        closeEyeDialog();

        if (action === 'stop') {
            stopEyeMsg();
        } else if (action === 'empty') {
            document.getElementById('eye-msg-text').textContent = '';
            startEyeMsg();
        } else { // The default action is 'resume'
            startEyeMsg();
        }
    }

    const closeEyeDialog = function() {
        eyeDialogOpen = false;
        clearInterval(eyeMsgInterval);

        document.querySelectorAll('#eye-msg-panel .eye-dialog').forEach(e => {
            document.body.appendChild(e);
            e.querySelectorAll('.highlight').forEach(ee => {
                ee.classList.remove('highlight');
            });
        });
    }
}

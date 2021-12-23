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
        alert('Unable to detect a camera');
        window.history.go(-1);
    }

    navigator.mediaDevices.enumerateDevices().then(devices => {
        devices.forEach(device => {
            console.log(device.kind);
            if (device.kind === 'videoinput') hasVideoDevice = true;
        });

        if (!hasVideoDevice) {
            alert('Unable to detect a camera');
            window.history.go(-1);
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

    ///////////////////////////////////////////////////////////////
    // Mode is either 'chat' or 'compose'
    let eyeMsgMode = ['chat', 'compose'].includes(sessionStorage.getItem('eyeMsgMode')) ? sessionStorage.getItem('eyeMsgMode') : 'chat';
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

    const eyeMsgAlphaKeys = [
        ['A', 'B', 'C', 'D', 'E', 'F'],
        ['G', 'H', 'I', 'J', 'K', 'L'],
        ['M', 'N', 'O', 'P', 'Q', 'R'],
        ['S', 'T', 'U', 'V', 'W', 'X'],
        ['Y', 'Z', '?', '.', ',', '\'', '!'],
    ];

    const eyeMsgSpecialKeys = {
        'chat': ['_', '⌫', '⏯︎', 'Empty'],
        'compose': ['_', '⌫', '↵', '⏯︎', 'Stop'],
    };

    // Page load should not contain any previous text.
    document.querySelector('#eye-msg-text').value = '';

    const setUpEyeMsg = function(proceed = true) {
        try { webgazer.clearGazeListener(); } catch (error) { console.log(error); }
        try { clearInterval(eyeMsgInterval); } catch (error) { console.log(error); }

        eyeMsgCharsetIndex = 0;
        eyeMsgCharIndex = 0;
        eyeMsgSelectMode = 'charset';
        eyeMsgCharRotationNum = 0;
        eyeMsgInterval = null;

        eyeMsgChars = [];
        for (const charset of eyeMsgAlphaKeys) eyeMsgChars.push(charset);
        eyeMsgChars.push(eyeMsgSpecialKeys[eyeMsgMode]);

        let html = '';

        for (let i = 0; i < eyeMsgChars.length; i ++) {
            html += '<div class="eye-msg-charset">';
            eyeMsgChars[i].forEach(val => { html += '<span>' + val + '</span>'; });
            html += '</div>';
        }

        document.querySelector('.eye-msg-charsets').innerHTML = html;
        //document.querySelector('#eye-msg-text').value = '';
        {
            const e = document.querySelector('#eye-msg-text');
            e.focus();
            e.setSelectionRange(e.value.length, e.value.length);
        }

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
        clearInterval(eyeMsgInterval);
        eyeMsgInterval = setInterval(() => { setEyeMsgFocus(); }, charRotationPause);
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

    document.querySelectorAll('#eye-msg-menu .mode').forEach(e => {
        e.value = eyeMsgMode;

        e.addEventListener('change', function() {
            eyeMsgMode = this.value;
            sessionStorage.setItem('eyeMsgMode', eyeMsgMode);
            startEyeMsg();
        });
    });

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
            m.focus();
            m.setSelectionRange(0, m.value.length);
            navigator.clipboard.writeText(m.value.trim());
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

            webgazer.clearGazeListener();
        } catch (error) {
            console.log(error);
        }
    }

    const setEyeMsgFocus = function() {
        //document.querySelectorAll('#eye-msg-charsets .highlight').forEach(e => { e.classList.remove('highlight'); });
        document.querySelectorAll('.eye-msg-charsets .highlight').forEach(e => { e.classList.remove('highlight'); });

        //if (document.activeElement == document.querySelector('#eye-msg-menu .mode')) return;
        
        //const charsets = document.querySelectorAll('#eye-msg-charsets .eye-msg-charset');
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
        //const highlighted = document.querySelector('#eye-msg-charsets .highlight');
        const highlighted = document.querySelector('.eye-msg-charsets .highlight');

        if (highlighted) {
            highlighted.classList.remove('highlight');
            clearInterval(eyeMsgInterval);
            eyeMsgInterval = null;

            const c = highlighted.textContent;

            if (['Pause', '⏸', '⏯︎'].includes(c)) {
                if (['Pause', '⏸', '⏯︎'].includes(c)) {
                    highlighted.classList.add('highlight');
                    eyeMsgPaused = true;

                    eyeMsgSelectMode = 'charset';
                    eyeMsgCharsetIndex = 0;
                }

                return;
            } else if (['Stop', 'Done'].includes(c)) {
                stopEyeMsg();
                highlighted.classList.add('highlight');
                return;
            }

            if (eyeMsgSelectMode === 'charset') {
                eyeMsgSelectMode = 'char';
                eyeMsgCharIndex = 0;
                eyeMsgCharsetIndex = eyeMsgCharsetIndex - 1;
                //if (eyeMsgCharsetIndex < 0) eyeMsgCharsetIndex = document.querySelectorAll('#eye-msg-charsets .eye-msg-charset').length - 1;
                if (eyeMsgCharsetIndex < 0) eyeMsgCharsetIndex = document.querySelectorAll('.eye-msg-charset').length - 1;
            } else { // Character select mode
                const m = document.getElementById('eye-msg-text');

                if (['⌫', '«', '<'].includes(c)) {
                    m.value = m.value.substring(0, m.value.length - 1);
                } else if (['_', '␣'].includes(c)) {
                    m.value += ' ';
                } else if (['Clear', 'Reset', 'Empty', 'NewMsg'].includes(c)) {
                    m.value = '';
                } else if (['↵'].includes(c)) {
                    m.value += "\n\n";
                } else {
                    m.value += c;
                    if (['.', '?', ',', '!'].includes(c)) m.value += ' ';
                }

                m.focus();
                m.setSelectionRange(m.value.length, m.value.length);

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
                if (eyeMsgPaused === true) {
                    //document.getElementById('eye-msg-text').textContent = '';
                }

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
                    /*eyeMsgSelectMode = 'charset';
                    eyeMsgCharsetIndex = 0;*/
                } else {
                    selectEyeMsgValue();
                }
            }
        }
    }
}

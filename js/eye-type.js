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
        if (!calibrationPrecheckStart) calibrationPreCheckStart = now;

        if (c && b && b.style && b.style.borderColor && b.style.borderColor == 'green') {
            hideMessage();
            setTimeout(() => { startCalibration(); }, 1000);
            calibrationPrecheckStart = null;
        } else {
            if (c && calibrationPrecheckStart < now - 2000) {
                if (calibrationPrecheckStart < now - 10000) c.classList.add('error');
                showMessage('Make sure the camera can see your eyes');
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
    let charRotationPause = 1500;

    const setRotationPause = function(ms = 1500) {
        if (parseInt(ms) >= 1000) charRotationPause = parseInt(ms);
    }
    ///////////////////////////////////////////////////////////////


    const clearView = function() {
        if (webgazer) {
            try {
                webgazer.clearGazeListener();
            } catch (error) {
                console.log(error);
            }
        }

        document.querySelectorAll('#eye-msg-background').forEach(e => {
            e.remove();
        });
    }


    //////////////////////////////////////////////////////////////
    // Section based typing
    let eyeMsgCharsetIndex = 0;
    let eyeMsgCharIndex = 0;
    let eyeMsgInterval = null;
    let eyeMsgSelectMode = 'charset';
    let eyeMsgCharRotationNum = 0;
    let eyeMsgPaused = false;
    let eyePosition, eyePositionStartTime, eyeCursorMove;

    const eyeMsgChars = [
        ['A', 'B', 'C', 'D', 'E', 'F'],
        ['G', 'H', 'I', 'J', 'K', 'L'],
        ['M', 'N', 'O', 'P', 'Q', 'R'],
        ['S', 'T', 'U', 'V', 'W', 'X'],
        ['Y', 'Z', '?', '.', ',', '\'', '!'],
        ['_', '⌫', '⏯︎', 'Clear'],
        //['_', '⌫', '?', '.', ',', '\'', '!'],
        //['Done'],
        //['Clear', 'Pause'],
    ];

    const setEyeMsg = function() {
        clearView();

        eyeMsgCharsetIndex = 0;
        eyeMsgCharIndex = 0;
        eyeMsgSelectMode = 'charset';
        eyeMsgCharRotationNum = 0;
        eyeMsgInterval = null;

        let html = '<div id="eye-msg-background" class="clear">';

        html += '<div id="eye-msg-space">';

        html += '<div id="eye-msg-panel">';
        html += '<div id="eye-msg-charsets-parent">';
        html += '<div class="eye-msg-charsets">';

        for (let i = 0; i < eyeMsgChars.length; i ++) {
            /*if (i === Math.ceil(eyeMsgChars.length / 2)) {
                html += '</div>';
                html += '<div class="eye-msg-charsets">';
            }*/

            html += '<div class="eye-msg-charset">';
            eyeMsgChars[i].forEach(val => {
                html += '<span>' + val + '</span>';
            });
            html += '</div>';
        }

        html += '</div>'; // .eye-msg-charsets
        html += '</div>'; // #eye-msg-charsets-parent
        //html += '<hr>';

        html += '<div id="eye-msg-select"><i class="fas fa-check-circle"></i></div>'; // #eye-msg-select
        html += '</div>'; // #eye-msg-panel

        html += '<div id="eye-msg"><div id="eye-msg-text"></div></div>'; // #eye-msg

        html += '<div id="eye-msg-menu">';
        html += '<div style="margin-right: 20px;">Speed <input type="number" class="interval" min="1" max="10" step="0.1" value="' + (charRotationPause / 1000) + '" style="width: 4em;"> seconds</div>';
        html += '<button class="recalibrate"><i class="fas fa-bullseye"></i> Recalibrate</button>';
        html += '<button class="quit">🛑 Quit</button>';
        html += '</div>'; // #eye-msg-menu

        html += '</div>'; // #eye-msg-space

        html += '</div>'; // #eye-msg-background

        document.body.insertAdjacentHTML('beforeend', html);

        // If the charset divs wrap we should get rid of the border on the second one
        {
            const e = document.querySelectorAll('.eye-msg-charsets');

            if (e[1] && e[1].offsetTop > e[0].offsetTop) {
                for (let i = 1; i < e.length; i ++) {
                    e[i].classList.add('wrapped');
                }
            }
        }

        setTimeout(function() {
            document.querySelector('#eye-msg-background').classList.remove('clear');
        }, 0);

        eyeMsgInterval = setInterval(() => { setEyeMsgFocus(); }, charRotationPause);

        ///////////////////////////////////////////
        // Menu listeners
        document.querySelector('#eye-msg-menu .interval').addEventListener('change', function() {
            charRotationPause = this.value * 1000;
            clearInterval(eyeMsgInterval);
            eyeMsgInterval = setInterval(() => { setEyeMsgFocus(); }, charRotationPause);
        });

        document.querySelector('#eye-msg-menu .quit').addEventListener('click', function() {
            window.history.go(-1);
        });

        document.querySelector('#eye-msg-menu .recalibrate').addEventListener('click', function() {
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
        });
    }

    const startEyeMsg = function() {
        hideMessage();
        setEyeMsg();
        webgazer.setGazeListener(eyeFollower);
    }

    const hideEyeMsg = function() {
        if (eyeMsgInterval) {
            clearInterval(eyeMsgInterval);
            eyeMsgInterval = null;
        }

        try { webgazer.clearGazeListener(); } catch (error) {};
        document.querySelectorAll('#eye-msg-background, #eye-msg-select').forEach(e => { e.remove(); });
    }

    const setEyeMsgFocus = function() {
        //document.querySelectorAll('#eye-msg-charsets .highlight').forEach(e => { e.classList.remove('highlight'); });
        document.querySelectorAll('.eye-msg-charsets .highlight').forEach(e => { e.classList.remove('highlight'); });
        
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

            if (['Pause', '⏸', '⏯︎', 'Stop', 'Done'].includes(c)) {
                if (['Pause', '⏸', '⏯︎'].includes(c)) {
                    highlighted.classList.add('highlight');
                    eyeMsgPaused = true;
                }

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
                    m.textContent = m.textContent.replace(/.$/, '');
                } else if (['_', '␣'].includes(c)) {
                    m.textContent += ' ';
                } else if (['Clear', 'Rest'].includes(c)) {
                    m.textContent = '';
                } else {
                    m.textContent += c;
                    if (['.', '?', ',', '!'].includes(c)) m.textContent += ' ';
                }

                eyeMsgSelectMode = 'charset';
                eyeMsgCharsetIndex = 0;
            }
        }

        eyeMsgInterval = setInterval(setEyeMsgFocus, charRotationPause);
    }

    const eyeFollower = function(data, clock) {
        if (!data) return;

        let pos;

        let rightSide = document.getElementById('eye-msg-space').getBoundingClientRect().right * 0.75;

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

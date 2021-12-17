{
    // Check for a camera
    (async function() {
        let hasVideoDevice = false;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            for (const device of devices) {
                if (device.kind === 'videoinput') {
                    hasVideoDevice = true;
                }
            }
        } catch (error) {
            console.log('Unable to list media devices');
        }

        if (hasVideoDevice) {
        } else {
            document.querySelectorAll('#no-camera-msg').forEach(e => {
                e.classList.remove('hidden');
            });

            document.querySelectorAll('.typewriter-link, .demo-link').forEach(e => {
                e.remove();
            });
        }
    })();
}

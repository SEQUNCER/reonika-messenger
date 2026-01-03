// permission-manager.js
class PermissionManager {
    constructor() {
        this.permissions = {
            notifications: 'default',
            microphone: 'default',
            camera: 'default',
            clipboard: 'default',
            geolocation: 'default',
            persistentStorage: 'default'
        };

        console.log('Permission Manager initialized');
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return { permission: 'unsupported', name: 'notifications' };
        }

        try {
            const permission = await Notification.requestPermission();
            this.permissions.notifications = permission;
            console.log(`Notification permission: ${permission}`);
            return { permission, name: 'notifications' };
        } catch (error) {
            console.error(`Error requesting notification permission: ${error.message}`);
            return { permission: 'error', name: 'notifications', error };
        }
    }

    async requestMicrophonePermission() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('Microphone not supported');
            return { permission: 'unsupported', name: 'microphone' };
        }

        try {
            let permissionState = 'prompt';

            if (navigator.permissions) {
                try {
                    const permission = await navigator.permissions.query({ name: 'microphone' });
                    permissionState = permission.state;
                    this.permissions.microphone = permission.state;
                } catch (permError) {
                    console.log(`Could not query microphone permission: ${permError.message}`);
                }
            }

            if (permissionState === 'prompt' || permissionState === 'default') {
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                stream.getTracks().forEach(track => track.stop());

                if (navigator.permissions) {
                    try {
                        const updatedPermission = await navigator.permissions.query({ name: 'microphone' });
                        this.permissions.microphone = updatedPermission.state;
                        console.log(`Microphone permission granted: ${updatedPermission.state}`);
                        return { permission: updatedPermission.state, name: 'microphone' };
                    } catch (updateError) {
                        console.log(`Could not update microphone permission status: ${updateError.message}`);
                    }
                }

                console.log('Microphone permission granted');
                return { permission: 'granted', name: 'microphone' };
            }

            return { permission: permissionState, name: 'microphone' };
        } catch (error) {
            console.error(`Error requesting microphone permission: ${error.message}`);

            if (error.name === 'NotAllowedError') {
                console.log('Microphone access denied by user');
            } else if (error.name === 'NotFoundError') {
                console.log('No microphone device found');
            } else if (error.name === 'NotReadableError') {
                console.log('Microphone is already in use by another application');
            }

            return { permission: 'denied', name: 'microphone', error };
        }
    }

    async requestEssentialPermissions() {
        console.log('Requesting essential permissions at startup...');

        const permissionPromises = [
            this.requestNotificationPermission(),
            this.requestMicrophonePermission()
        ];

        try {
            const results = await Promise.allSettled(permissionPromises);
            console.log('Essential permission request results:', results);
            return results;
        } catch (error) {
            console.error(`Error requesting essential permissions: ${error.message}`);
            return [];
        }
    }
}

// Инициализация менеджера разрешений
window.permissionManager = new PermissionManager();
console.log('Permission Manager initialized');

// Экспортируем класс для использования в других модулях
export { PermissionManager };

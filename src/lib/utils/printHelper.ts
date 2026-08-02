export function executePrint(intentUrl: string) {
    // Check if the current platform is Android
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (isAndroid) {
        // Fallback to standard intent link for Android devices
        window.location.href = intentUrl;
    } else {
        // Endpoints to attempt (localhost is treated as secure context by Chromium)
        const endpoints = ["ws://localhost:40213/", "ws://127.0.0.1:40213/"];
        let index = 0;

        function tryConnect() {
            if (index >= endpoints.length) {
                alert("Printer tidak dapat diakses!\nPastikan 'RawBT Print Server' sudah dijalankan di komputer ini.");
                return;
            }

            const url = endpoints[index++];

            try {
                const socket = new WebSocket(url);
                let sent = false;

                socket.onopen = () => {
                    sent = true;
                    socket.send(intentUrl);
                    socket.close(1000, "Print request sent");
                };

                socket.onerror = (err) => {
                    console.warn(`Failed connecting to ${url}:`, err);
                    if (!sent) {
                        tryConnect();
                    }
                };
            } catch (e) {
                console.warn(`Exception connecting to ${url}:`, e);
                tryConnect();
            }
        }

        tryConnect();
    }
}

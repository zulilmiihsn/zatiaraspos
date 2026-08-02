export function executePrint(intentUrl: string) {
    // Check if the current platform is Android
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (isAndroid) {
        // Fallback to standard intent link for Android devices
        window.location.href = intentUrl;
    } else {
        // Forward intent data to local WebSocket for PCs
        const socket = new WebSocket("ws://127.0.0.1:40213/");
        
        socket.onerror = () => {
            alert("Printer tidak dapat diakses!\nPastikan 'RawBT Print Server' sudah dijalankan di komputer ini.");
        };
        
        socket.onopen = () => {
            // Server expects the raw intent string, it handles parsing base64 itself
            socket.send(intentUrl);
            // Close connection properly
            socket.close(1000, "Print request sent");
        };
    }
}

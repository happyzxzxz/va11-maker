export class VideoRecorder {
    private mediaRecorder!: MediaRecorder;
    private recordedChunks: Blob[] = [];

    constructor(canvas: HTMLCanvasElement, audioStream: MediaStream) {

        const canvasStream = (canvas as any).captureStream ? 
            (canvas as any).captureStream(30) : 
            (canvas as any).mozCaptureStream(30);

        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioStream.getAudioTracks()
        ]);

        const possibleTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4', // Safari fallback
        ];

        const mimeType = possibleTypes.find(type => MediaRecorder.isTypeSupported(type));

        if (!mimeType) {
            throw new Error("No supported MediaRecorder MIME types found in this browser.");
        }

        this.mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 8000000
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
    }

    public start() {
        this.recordedChunks = [];
        this.mediaRecorder.start();
    }

    public stop(): Promise<Blob> {
        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
                resolve(blob);
            };
            this.mediaRecorder.stop();
        });
    }
}
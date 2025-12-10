/**
 * Processes an avatar image file:
 * 1. Loads the image.
 * 2. Resizes it to a maximum dimension (e.g., 300px).
 * 3. Compresses it to JPEG format.
 * 4. Returns the Base64 string.
 */
export const processAvatarImage = (file: File, maxWidth = 300, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('File is not an image'));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width = Math.round((width * maxWidth) / height);
                        height = maxWidth;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Draw image to canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Export as Base64 JPEG
                const base64 = canvas.toDataURL('image/jpeg', quality);
                resolve(base64);
            };

            img.onerror = (error) => reject(error);
        };

        reader.onerror = (error) => reject(error);
    });
};

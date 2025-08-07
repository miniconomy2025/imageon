interface Config {
    API_URL: string;
    MOCK_DATA: boolean;
    MOCK_IMAGE_URL: string;
}

export const config: Config = {
    API_URL: import.meta.env.VITE_API_URL || '',
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA === 'true',
    MOCK_IMAGE_URL: import.meta.env.VITE_MOCK_IMAGE_URL || ''
};

export type { Config };

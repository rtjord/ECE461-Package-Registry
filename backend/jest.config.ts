export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // Add other options here, like test match patterns, coverage, etc.
    testMatch: ['**/*.test.ts'],
    setupFiles: ['./jest.setup.ts'], // Ensure the setup file is loaded
};

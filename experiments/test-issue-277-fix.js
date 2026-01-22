/**
 * Test the fix for issue #277
 * Verify that safeDecodeURIComponent handles all edge cases correctly
 */

// Implementation of safeDecodeURIComponent (from project.js)
function safeDecodeURIComponent(str) {
    // First, try standard decoding
    try {
        return decodeURIComponent(str);
    } catch (e) {
        // If standard decoding fails, decode only valid percent-encoded sequences
        // This handles cases where the URL is partially encoded or has invalid sequences
        try {
            return str.replace(/%[0-9A-Fa-f]{2}/g, (match) => {
                try {
                    return decodeURIComponent(match);
                } catch {
                    return match; // Keep the original if it can't be decoded
                }
            });
        } catch {
            // If even selective decoding fails, return the original string
            return str;
        }
    }
}

// Test cases covering various scenarios
const testCases = [
    {
        name: 'Issue #277 example URL - mixed encoding with unescaped special chars',
        input: 'https://disk.yandex.ru/d/0UibwtIFW0invw/2%20%D1%8D%D1%82%D0%B0%D0%B6%20(%D0%92%D0%922.1%3B%202.2%3B%202.3)',
        expected: 'https://disk.yandex.ru/d/0UibwtIFW0invw/2 этаж (ВВ2.1; 2.2; 2.3)',
    },
    {
        name: 'Fully encoded URL',
        input: 'https://example.com/file%20name.pdf',
        expected: 'https://example.com/file name.pdf',
    },
    {
        name: 'Already decoded URL',
        input: 'https://example.com/file name.pdf',
        expected: 'https://example.com/file name.pdf',
    },
    {
        name: 'Cyrillic characters encoded',
        input: 'https://example.com/%D1%84%D0%B0%D0%B9%D0%BB.pdf',
        expected: 'https://example.com/файл.pdf',
    },
    {
        name: 'Mixed encoded and unencoded Cyrillic',
        input: 'https://example.com/файл%20имя.pdf',
        expected: 'https://example.com/файл имя.pdf',
    },
    {
        name: 'Invalid encoding - incomplete sequence',
        input: 'https://example.com/test%2.pdf',
        expected: 'https://example.com/test%2.pdf', // Should keep original
    },
    {
        name: 'Invalid encoding - non-hex characters',
        input: 'https://example.com/test%GG.pdf',
        expected: 'https://example.com/test%GG.pdf', // Should keep original
    },
    {
        name: 'Mixed valid and invalid encoding',
        input: 'https://example.com/file%20name%2.pdf',
        expected: 'https://example.com/file name%2.pdf', // Decode valid %20, keep invalid %2
    },
    {
        name: 'Parentheses unencoded',
        input: 'https://example.com/test(1).pdf',
        expected: 'https://example.com/test(1).pdf',
    },
    {
        name: 'Parentheses encoded',
        input: 'https://example.com/test%281%29.pdf',
        expected: 'https://example.com/test(1).pdf',
    },
    {
        name: 'Semicolons unencoded',
        input: 'https://example.com/test;file.pdf',
        expected: 'https://example.com/test;file.pdf',
    },
    {
        name: 'Semicolons encoded',
        input: 'https://example.com/test%3Bfile.pdf',
        expected: 'https://example.com/test;file.pdf',
    },
    {
        name: 'UTF-8 special character (star)',
        input: 'https://example.com/%E2%98%85.pdf',
        expected: 'https://example.com/★.pdf',
    },
    {
        name: 'Incomplete UTF-8 sequence',
        input: 'https://example.com/%E2%98.pdf',
        expected: 'https://example.com/%E2%98.pdf', // Should keep original
    },
    {
        name: 'Trailing percent sign',
        input: 'https://example.com/test%',
        expected: 'https://example.com/test%', // Should keep original
    },
    {
        name: 'Double percent',
        input: 'https://example.com/test%%20file.pdf',
        expected: 'https://example.com/test% file.pdf', // First % stays, %20 decodes
    },
    {
        name: 'Empty string',
        input: '',
        expected: '',
    },
    {
        name: 'No special characters',
        input: 'https://example.com/file.pdf',
        expected: 'https://example.com/file.pdf',
    },
];

// Run tests
console.log('=== Testing safeDecodeURIComponent (Issue #277 Fix) ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    const result = safeDecodeURIComponent(testCase.input);
    const success = result === testCase.expected;

    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`  Input:    ${testCase.input}`);
    console.log(`  Expected: ${testCase.expected}`);
    console.log(`  Got:      ${result}`);

    if (success) {
        console.log('  ✓ PASS\n');
        passed++;
    } else {
        console.log('  ✗ FAIL\n');
        failed++;
    }
});

console.log('=== Test Summary ===');
console.log(`Total: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
} else {
    console.log('\n✗ Some tests failed!');
    process.exit(1);
}

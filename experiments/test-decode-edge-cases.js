/**
 * Test edge cases for URL decoding
 * Testing cases where decodeURIComponent throws errors
 */

// Edge cases that can cause decodeURIComponent to throw
const edgeCases = [
    // Invalid percent encoding (odd number of characters after %)
    { url: 'https://example.com/test%2.pdf', desc: 'Invalid percent encoding (incomplete)' },
    { url: 'https://example.com/test%GG.pdf', desc: 'Invalid percent encoding (non-hex)' },
    { url: 'https://example.com/test%.pdf', desc: 'Percent without hex digits' },

    // From issue - this should work fine
    { url: 'https://disk.yandex.ru/d/0UibwtIFW0invw/2%20%D1%8D%D1%82%D0%B0%D0%B6%20(%D0%92%D0%922.1%3B%202.2%3B%202.3)', desc: 'Issue #277 example URL' },

    // Already decoded with special chars
    { url: 'https://example.com/test (1).pdf', desc: 'Already decoded with parentheses' },

    // Mixed valid and invalid encoding
    { url: 'https://example.com/file%20name%2.pdf', desc: 'Mixed valid and invalid encoding' },

    // UTF-8 sequences
    { url: 'https://example.com/%E2%98%85.pdf', desc: 'Valid UTF-8 sequence (star)' },
    { url: 'https://example.com/%E2%98.pdf', desc: 'Incomplete UTF-8 sequence' },

    // Trailing percent
    { url: 'https://example.com/test%', desc: 'Trailing percent sign' },

    // Multiple percent signs
    { url: 'https://example.com/test%%20file.pdf', desc: 'Double percent' },
];

console.log('=== Testing decodeURIComponent Edge Cases ===\n');

edgeCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.desc}`);
    console.log(`  URL: ${testCase.url}`);

    // Test standard decodeURIComponent
    console.log('  Standard decodeURIComponent:');
    try {
        const result = decodeURIComponent(testCase.url);
        console.log('    ✓ Success:', result);
    } catch (e) {
        console.log('    ✗ Error:', e.message);
    }

    // Test with try-catch (current implementation)
    console.log('  With try-catch (current):');
    let url = testCase.url;
    try {
        url = decodeURIComponent(url);
        console.log('    ✓ Decoded:', url);
    } catch (e) {
        console.log('    ⚠ Caught error, using original:', url);
    }

    console.log('');
});

console.log('✓ All edge case tests completed!');

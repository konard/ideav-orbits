/**
 * Test URL decoding for issue #277
 * URL may contain unescaped special characters, and decoding should not break
 * Example URL: https://disk.yandex.ru/d/0UibwtIFW0invw/2%20%D1%8D%D1%82%D0%B0%D0%B6%20(%D0%92%D0%922.1%3B%202.2%3B%202.3)
 */

// Test URLs with various encoding states
const testUrls = [
    // From issue #277 - mixed encoding with unescaped parentheses and semicolons
    'https://disk.yandex.ru/d/0UibwtIFW0invw/2%20%D1%8D%D1%82%D0%B0%D0%B6%20(%D0%92%D0%922.1%3B%202.2%3B%202.3)',

    // Fully encoded version
    'https://disk.yandex.ru/d/0UibwtIFW0invw/2%20%D1%8D%D1%82%D0%B0%D0%B6%20(%D0%92%D0%922.1%3B%202.2%3B%202.3)'.replace(/\(/g, '%28').replace(/\)/g, '%29'),

    // Not encoded at all
    'https://disk.yandex.ru/d/0UibwtIFW0invw/2 этаж (ВР2.1; 2.2; 2.3)',

    // Additional edge cases
    'https://example.com/file%20name.pdf',
    'https://example.com/file name.pdf',
    'https://example.com/файл%20имя.pdf',
    'https://example.com/%D1%84%D0%B0%D0%B9%D0%BB.pdf',
    'https://example.com/test(1).pdf',
    'https://example.com/test%281%29.pdf',
];

// Original formatLinkText function (simplified for testing)
function formatLinkTextOriginal(url) {
    if (!url) return '';

    // Trim whitespace
    url = url.trim();

    // Decode URL-encoded characters (e.g., %D0%9F -> П for Cyrillic)
    try {
        url = decodeURIComponent(url);
    } catch (e) {
        // URL might contain invalid encoding, continue with original
        console.log('  [DECODE ERROR]:', e.message);
    }

    // Find last dot position
    const lastDotIndex = url.lastIndexOf('.');

    if (lastDotIndex > 0 && lastDotIndex < url.length - 1) {
        // Has extension
        const extension = url.substring(lastDotIndex); // includes the dot
        const beforeDot = url.substring(0, lastDotIndex);

        // Get last 5 characters before the dot
        const shortPart = beforeDot.length > 5 ? beforeDot.substring(beforeDot.length - 5) : beforeDot;
        const result = shortPart + extension;

        // If result is longer than 13 characters, just use last 13
        if (result.length > 13) {
            return url.substring(url.length - 13);
        }
        return result;
    } else {
        // No extension or unusual format - use last 13 characters
        return url.length > 13 ? url.substring(url.length - 13) : url;
    }
}

// Improved function with safe decoding
function safeDecodeURIComponent(str) {
    // Try to decode, but if it fails, try a more careful approach
    try {
        return decodeURIComponent(str);
    } catch (e) {
        // If direct decoding fails, it might be because the URL is already partially decoded
        // or contains invalid sequences. Try to decode only valid sequences.
        try {
            // Replace only valid percent-encoded sequences
            return str.replace(/%[0-9A-Fa-f]{2}/g, (match) => {
                try {
                    return decodeURIComponent(match);
                } catch {
                    return match; // Keep the original if it can't be decoded
                }
            });
        } catch {
            // If even this fails, return the original string
            return str;
        }
    }
}

// Improved formatLinkText function
function formatLinkTextImproved(url) {
    if (!url) return '';

    // Trim whitespace
    url = url.trim();

    // Decode URL-encoded characters safely
    url = safeDecodeURIComponent(url);

    // Find last dot position
    const lastDotIndex = url.lastIndexOf('.');

    if (lastDotIndex > 0 && lastDotIndex < url.length - 1) {
        // Has extension
        const extension = url.substring(lastDotIndex); // includes the dot
        const beforeDot = url.substring(0, lastDotIndex);

        // Get last 5 characters before the dot
        const shortPart = beforeDot.length > 5 ? beforeDot.substring(beforeDot.length - 5) : beforeDot;
        const result = shortPart + extension;

        // If result is longer than 13 characters, just use last 13
        if (result.length > 13) {
            return url.substring(url.length - 13);
        }
        return result;
    } else {
        // No extension or unusual format - use last 13 characters
        return url.length > 13 ? url.substring(url.length - 13) : url;
    }
}

// Run tests
console.log('=== Testing URL Decoding (Issue #277) ===\n');

testUrls.forEach((url, index) => {
    console.log(`Test ${index + 1}: ${url.substring(0, 60)}${url.length > 60 ? '...' : ''}`);

    console.log('  Original function:');
    try {
        const result = formatLinkTextOriginal(url);
        console.log('    Result:', result);
    } catch (e) {
        console.log('    ERROR:', e.message);
    }

    console.log('  Improved function:');
    try {
        const result = formatLinkTextImproved(url);
        console.log('    Result:', result);
    } catch (e) {
        console.log('    ERROR:', e.message);
    }

    console.log('');
});

// Test safeDecodeURIComponent directly
console.log('=== Testing safeDecodeURIComponent ===\n');

const decodeTests = [
    '2%20%D1%8D%D1%82%D0%B0%D0%B6%20(%D0%92%D0%922.1%3B%202.2%3B%202.3)',
    'file%20name.pdf',
    'already decoded файл.pdf',
    '%D1%84%D0%B0%D0%B9%D0%BB.pdf',
    'mixed%20encoding файл.pdf',
];

decodeTests.forEach((test, index) => {
    console.log(`Decode test ${index + 1}: ${test}`);
    console.log('  Result:', safeDecodeURIComponent(test));
    console.log('');
});

console.log('✓ All tests completed!');

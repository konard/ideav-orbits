/**
 * Test URL parameter parsing functionality
 * This test verifies that the script correctly parses URL parameters
 */

// Mock URLSearchParams for testing
class MockURLSearchParams {
    constructor(queryString) {
        this.params = new Map();
        if (queryString) {
            // Remove leading '?' if present
            queryString = queryString.replace(/^\?/, '');
            const pairs = queryString.split('&');
            pairs.forEach(pair => {
                const [key, value] = pair.split('=');
                if (key) {
                    this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
                }
            });
        }
    }

    has(key) {
        return this.params.has(key);
    }

    get(key) {
        return this.params.get(key);
    }
}

// Test cases
const testCases = [
    {
        name: 'No parameters - defaults should be used',
        queryString: '',
        expected: {
            enableCleanup: false,
            projectId: null
        }
    },
    {
        name: 'enableCleanup=true',
        queryString: '?enableCleanup=true',
        expected: {
            enableCleanup: true,
            projectId: null
        }
    },
    {
        name: 'enableCleanup=false',
        queryString: '?enableCleanup=false',
        expected: {
            enableCleanup: false,
            projectId: null
        }
    },
    {
        name: 'enableCleanup=1 (truthy)',
        queryString: '?enableCleanup=1',
        expected: {
            enableCleanup: true,
            projectId: null
        }
    },
    {
        name: 'enableCleanup=0 (falsy)',
        queryString: '?enableCleanup=0',
        expected: {
            enableCleanup: false,
            projectId: null
        }
    },
    {
        name: 'ProjID=123',
        queryString: '?ProjID=123',
        expected: {
            enableCleanup: false,
            projectId: 123
        }
    },
    {
        name: 'Both parameters',
        queryString: '?enableCleanup=true&ProjID=456',
        expected: {
            enableCleanup: true,
            projectId: 456
        }
    },
    {
        name: 'Both parameters (different order)',
        queryString: '?ProjID=789&enableCleanup=false',
        expected: {
            enableCleanup: false,
            projectId: 789
        }
    }
];

// Simulate the parseUrlParameters function
function parseUrlParameters(queryString, CONFIG) {
    const urlParams = new MockURLSearchParams(queryString);

    // Parse enableCleanup parameter
    if (urlParams.has('enableCleanup')) {
        const enableCleanupParam = urlParams.get('enableCleanup');
        CONFIG.enableCleanup = enableCleanupParam === 'true' || enableCleanupParam === '1';
    }

    // Parse ProjID parameter
    if (urlParams.has('ProjID')) {
        const projIdParam = urlParams.get('ProjID');
        CONFIG.projectId = projIdParam ? parseInt(projIdParam, 10) : null;
    }
}

// Run tests
console.log('=== Testing URL Parameter Parsing ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`  Query: ${testCase.queryString || '(empty)'}`);

    // Reset CONFIG for each test
    const CONFIG = {
        enableCleanup: false,
        projectId: null
    };

    // Parse parameters
    parseUrlParameters(testCase.queryString, CONFIG);

    // Check results
    const enableCleanupMatch = CONFIG.enableCleanup === testCase.expected.enableCleanup;
    const projectIdMatch = CONFIG.projectId === testCase.expected.projectId;

    console.log(`  Expected: enableCleanup=${testCase.expected.enableCleanup}, projectId=${testCase.expected.projectId}`);
    console.log(`  Got:      enableCleanup=${CONFIG.enableCleanup}, projectId=${CONFIG.projectId}`);

    if (enableCleanupMatch && projectIdMatch) {
        console.log(`  ✓ PASS\n`);
        passed++;
    } else {
        console.log(`  ✗ FAIL`);
        if (!enableCleanupMatch) {
            console.log(`    enableCleanup mismatch`);
        }
        if (!projectIdMatch) {
            console.log(`    projectId mismatch`);
        }
        console.log('');
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

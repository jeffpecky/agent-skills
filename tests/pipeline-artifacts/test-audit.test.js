'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Test Auditor', () => {
  it('should detect disabled tests', () => {
    const testContent = `
      it.skip('should handle edge case', () => {});
      describe.skip('feature group', () => {});
      test.skip('another test', () => {});
    `;
    
    const patterns = [
      /it\.skip\(/,
      /describe\.skip\(/,
      /test\.skip\(/,
      /xit\(/,
      /xdescribe\(/,
      /xtest\(/
    ];
    
    let disabledCount = 0;
    for (const pattern of patterns) {
      const matches = testContent.match(pattern);
      if (matches) disabledCount += matches.length;
    }
    
    assert.equal(disabledCount, 3);
  });

  it('should detect circular test patterns', () => {
    const testContent = `
      const fs = require('fs');
      const service = require('./service');
      
      it('should compute result', () => {
        const result = service.compute(input);
        fs.writeFileSync('expected.json', JSON.stringify(result));
        expect(result).toEqual(expected);
      });
    `;
    
    const hasWriteSync = /writeFileSync|writeFile|fs\.write/.test(testContent);
    const hasServiceImport = /require\(['"].*service['"]\)/.test(testContent);
    
    assert.equal(hasWriteSync && hasServiceImport, true);
  });

  it('should classify assertion strength', () => {
    const assertions = [
      { code: 'toBeDefined()', level: 'existence' },
      { code: 'typeof x === "number"', level: 'type' },
      { code: 'code === 200', level: 'status' },
      { code: 'toEqual(expected)', level: 'value' },
      { code: 'await workflow.complete()', level: 'behavioral' },
    ];
    
    for (const { code, level } of assertions) {
      let detected;
      if (/toBeDefined|!= null/.test(code)) detected = 'existence';
      else if (/typeof/.test(code)) detected = 'type';
      else if (/=== \d{3}/.test(code)) detected = 'status';
      else if (/toEqual|toBeCloseTo/.test(code)) detected = 'value';
      else if (/await|\.complete\(\)|\.then\(/.test(code)) detected = 'behavioral';
      
      assert.equal(detected, level, `Failed to detect ${level} for: ${code}`);
    }
  });
});

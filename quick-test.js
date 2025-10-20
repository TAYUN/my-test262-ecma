#!/usr/bin/env node

/**
 * 快速测试脚本 - 查看 MyPromise 的测试结果
 */

const { execSync } = require('child_process');

console.log('🧪 MyPromise 快速测试');
console.log('=' .repeat(50));

const testCategories = [
  {
    name: '基础功能测试',
    pattern: 'test/built-ins/Promise/constructor.js test/built-ins/Promise/length.js test/built-ins/Promise/name.js'
  },
  {
    name: '静态方法属性测试',
    pattern: '"test/built-ins/Promise/resolve/length.js" "test/built-ins/Promise/reject/length.js" "test/built-ins/Promise/all/length.js" "test/built-ins/Promise/race/length.js"'
  },
  {
    name: '原型方法属性测试',
    pattern: '"test/built-ins/Promise/prototype/then/length.js" "test/built-ins/Promise/prototype/catch/length.js" "test/built-ins/Promise/prototype/finally/length.js"'
  }
];

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

testCategories.forEach((category, index) => {
  console.log(`\n${index + 1}. ${category.name}`);
  console.log('-'.repeat(30));

  try {
    const command = `test262-harness --host-type node --host-path node --prelude ./adapter.js ${category.pattern}`;
    const output = execSync(command, { encoding: 'utf8', cwd: process.cwd() });

    console.log('原始输出:');
    console.log(output);

    // 解析输出
    const lines = output.trim().split('\n');

    // 查找包含测试结果的行
     let passed = 0, failed = 0, tests = 0;

     for (const line of lines) {
       // 查找 "Ran X tests" 行
       if (line.includes('Ran') && line.includes('tests')) {
         const testsMatch = line.match(/Ran (\d+) tests/);
         if (testsMatch) tests = parseInt(testsMatch[1]);
       }
       // 查找 "X passed" 行
       if (line.includes('passed')) {
         const passedMatch = line.match(/(\d+) passed/);
         if (passedMatch) passed = parseInt(passedMatch[1]);
       }
       // 查找 "X failed" 行
       if (line.includes('failed')) {
         const failedMatch = line.match(/(\d+) failed/);
         if (failedMatch) failed = parseInt(failedMatch[1]);
       }
     }

    totalPassed += passed;
    totalFailed += failed;
    totalTests += tests;

    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`📊 总计: ${tests}`);

    if (failed > 0) {
      console.log('⚠️  有失败的测试，查看上面的详细错误信息');

      // 显示失败的详细信息
      const failLines = lines.filter(line => line.startsWith('FAIL'));
      if (failLines.length > 0) {
        console.log('\n失败的测试:');
        failLines.forEach(line => {
          console.log(`  ${line}`);
        });
      }
    }

  } catch (error) {
    console.log(`❌ 测试执行失败: ${error.message}`);
  }
});

console.log('\n' + '='.repeat(50));
console.log('🎯 总体结果:');
console.log(`✅ 总通过: ${totalPassed}`);
console.log(`❌ 总失败: ${totalFailed}`);
console.log(`📊 总测试: ${totalTests}`);

if (totalTests > 0) {
  const passRate = ((totalPassed / totalTests) * 100).toFixed(1);
  console.log(`📈 通过率: ${passRate}%`);

  if (passRate >= 90) {
    console.log('🎉 优秀！你的 MyPromise 实现很棒！');
  } else if (passRate >= 70) {
    console.log('👍 不错！还有一些改进空间');
  } else {
    console.log('💪 继续努力！查看失败的测试来改进实现');
  }
}

console.log('\n💡 提示:');
console.log('- 运行 node quick-test.js 查看快速测试结果');
console.log('- 运行具体的 test262-harness 命令查看详细错误信息');
console.log('- 查看 final-test-report.md 获取完整的测试报告');

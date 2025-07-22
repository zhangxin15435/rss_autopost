import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs-extra';

// 加载环境变量
dotenv.config();

/**
 * Medium API 简单调试器
 * 用于快速诊断 API 认证和端点问题
 */
class MediumSimpleDebugger {
    constructor() {
        this.sessionToken = process.env.MEDIUM_SESSION_TOKEN;
        this.integrationToken = process.env.MEDIUM_INTEGRATION_TOKEN;
        this.userId = process.env.MEDIUM_USER_ID;
    }

    /**
     * 测试不同的认证方式
     */
    async testAuthentication() {
        console.log('🔐 测试 Medium 认证方式...\n');

        const results = {
            sessionToken: !!this.sessionToken,
            integrationToken: !!this.integrationToken,
            userId: !!this.userId,
            tests: []
        };

        console.log(`📋 配置状态:`);
        console.log(`  • Session Token: ${this.sessionToken ? '✅ 已设置' : '❌ 未设置'}`);
        console.log(`  • Integration Token: ${this.integrationToken ? '✅ 已设置' : '❌ 未设置'}`);
        console.log(`  • User ID: ${this.userId ? '✅ 已设置' : '❌ 未设置'}`);
        console.log('');

        return results;
    }

    /**
     * 测试多个 API 端点
     */
    async testApiEndpoints() {
        console.log('🧪 测试 Medium API 端点...\n');

        const testCases = [
            {
                name: '官方 API - 用户信息',
                url: 'https://api.medium.com/v1/me',
                method: 'GET',
                headers: this.integrationToken ? {
                    'Authorization': `Bearer ${this.integrationToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                } : null
            },
            {
                name: '内部 API - 用户信息 (旧)',
                url: 'https://medium.com/_/api/users/self',
                method: 'GET',
                headers: this.sessionToken ? {
                    'Cookie': `sid=${this.sessionToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                } : null
            },
            {
                name: '内部 API - 用户信息 (新)',
                url: 'https://medium.com/_/api/me',
                method: 'GET',
                headers: this.sessionToken ? {
                    'Cookie': `sid=${this.sessionToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                } : null
            },
            {
                name: 'GraphQL API',
                url: 'https://medium.com/_/graphql',
                method: 'POST',
                headers: this.sessionToken ? {
                    'Cookie': `sid=${this.sessionToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                } : null,
                body: JSON.stringify({
                    query: `query {
                        viewer {
                            id
                            name
                            username
                        }
                    }`
                })
            }
        ];

        const results = [];

        for (const testCase of testCases) {
            console.log(`🔗 测试: ${testCase.name}`);

            if (!testCase.headers) {
                console.log(`  ⏭️  跳过 (缺少认证信息)`);
                results.push({
                    ...testCase,
                    status: 'skipped',
                    reason: '缺少认证信息'
                });
                continue;
            }

            try {
                const response = await fetch(testCase.url, {
                    method: testCase.method,
                    headers: testCase.headers,
                    body: testCase.body,
                    timeout: 15000
                });

                const responseText = await response.text();
                let responseData;

                try {
                    responseData = JSON.parse(responseText);
                } catch {
                    responseData = responseText.substring(0, 200) + '...';
                }

                const result = {
                    ...testCase,
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    responseData: responseData,
                    responseHeaders: Object.fromEntries(response.headers.entries())
                };

                results.push(result);

                if (response.ok) {
                    console.log(`  ✅ 成功: ${response.status} ${response.statusText}`);
                    if (responseData && typeof responseData === 'object') {
                        if (responseData.data?.viewer) {
                            console.log(`    👤 用户: ${responseData.data.viewer.name || responseData.data.viewer.username}`);
                        } else if (responseData.data?.user) {
                            console.log(`    👤 用户: ${responseData.data.user.name || responseData.data.user.username}`);
                        } else if (responseData.payload?.user) {
                            console.log(`    👤 用户: ${responseData.payload.user.name || responseData.payload.user.username}`);
                        }
                    }
                } else {
                    console.log(`  ❌ 失败: ${response.status} ${response.statusText}`);
                    if (responseData && typeof responseData === 'object' && responseData.errors) {
                        console.log(`    📝 错误: ${JSON.stringify(responseData.errors)}`);
                    }
                }

            } catch (error) {
                console.log(`  ❌ 请求异常: ${error.message}`);
                results.push({
                    ...testCase,
                    status: 'error',
                    error: error.message
                });
            }

            console.log('');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }

    /**
     * 分析结果并提供建议
     */
    analyzeResults(results) {
        console.log('📊 结果分析和建议:\n');

        const successfulTests = results.filter(r => r.ok);
        const failedTests = results.filter(r => r.status && !r.ok);
        const errorTests = results.filter(r => r.status === 'error');
        const skippedTests = results.filter(r => r.status === 'skipped');

        console.log(`✅ 成功: ${successfulTests.length} 个测试`);
        console.log(`❌ 失败: ${failedTests.length} 个测试`);
        console.log(`🚫 错误: ${errorTests.length} 个测试`);
        console.log(`⏭️  跳过: ${skippedTests.length} 个测试\n`);

        if (successfulTests.length > 0) {
            console.log('🎉 发现可用的 API 端点:');
            successfulTests.forEach(test => {
                console.log(`  • ${test.name}: ${test.url}`);
            });
            console.log('');
        }

        // 提供具体建议
        console.log('💡 建议:');

        if (successfulTests.some(t => t.url.includes('api.medium.com'))) {
            console.log('  ✅ 官方 Integration Token 工作正常，建议优先使用');
        } else if (!this.integrationToken) {
            console.log('  🔑 建议获取官方 Integration Token (永久有效):');
            console.log('      访问 https://medium.com/me/settings');
            console.log('      滚动到 "Integration tokens" 部分获取');
        }

        if (failedTests.some(t => t.status === 404)) {
            console.log('  📍 某些 API 端点返回 404，可能已经更改');
            console.log('      这是您当前遇到的问题的根本原因');
        }

        if (failedTests.some(t => t.status === 401 || t.status === 403)) {
            console.log('  🔐 认证失败，请检查:');
            console.log('      • Session Token 是否已过期');
            console.log('      • Integration Token 是否正确');
            console.log('      • 用户账户是否正常');
        }

        if (successfulTests.length === 0 && this.sessionToken) {
            console.log('  🍪 Session Token 可能已过期，建议重新获取:');
            console.log('      1. 访问 https://medium.com');
            console.log('      2. 登录账户');
            console.log('      3. 从浏览器开发者工具获取新的 sid cookie');
        }

        if (successfulTests.length === 0) {
            console.log('  🔄 尝试使用浏览器自动化方案作为备选');
        }

        return {
            successful: successfulTests.length,
            failed: failedTests.length,
            errors: errorTests.length,
            skipped: skippedTests.length,
            recommendations: this.generateRecommendations(results)
        };
    }

    /**
     * 生成具体的修复建议
     */
    generateRecommendations(results) {
        const recommendations = [];

        const apiEndpoint404 = results.find(r => r.status === 404 && r.url.includes('/_/api/users/self'));
        if (apiEndpoint404) {
            recommendations.push({
                type: 'endpoint_change',
                message: 'Medium 内部 API 端点已更改，需要找到新的端点'
            });
        }

        const authFailures = results.filter(r => [401, 403].includes(r.status));
        if (authFailures.length > 0) {
            recommendations.push({
                type: 'auth_issue',
                message: '认证失败，需要更新认证令牌'
            });
        }

        const successful = results.filter(r => r.ok);
        if (successful.length > 0) {
            recommendations.push({
                type: 'working_endpoint',
                message: `发现可用端点: ${successful[0].url}`,
                endpoint: successful[0].url,
                method: successful[0].name
            });
        }

        return recommendations;
    }

    /**
     * 运行完整的诊断流程
     */
    async runDiagnosis() {
        try {
            console.log('🔧 Medium API 问题诊断器\n');
            console.log('='.repeat(50) + '\n');

            // 1. 测试认证配置
            const authStatus = await this.testAuthentication();

            // 2. 测试 API 端点
            const apiResults = await this.testApiEndpoints();

            // 3. 分析结果
            const analysis = this.analyzeResults(apiResults);

            // 4. 保存详细结果
            const fullReport = {
                timestamp: new Date().toISOString(),
                authStatus,
                apiResults,
                analysis
            };

            await fs.writeJson('medium_api_diagnosis.json', fullReport, { spaces: 2 });
            console.log('📁 详细报告已保存到: medium_api_diagnosis.json\n');

            // 5. 显示具体修复步骤
            console.log('🛠️  建议的修复步骤:');

            const workingEndpoint = analysis.recommendations.find(r => r.type === 'working_endpoint');
            if (workingEndpoint) {
                console.log(`\n1. 使用发现的可用端点:`);
                console.log(`   端点: ${workingEndpoint.endpoint}`);
                console.log(`   方法: ${workingEndpoint.method}`);
                console.log(`\n2. 修改 mediumApiPublisher.js 中的 API URL`);
            } else {
                console.log(`\n1. 获取有效的 Medium Integration Token:`);
                console.log(`   • 访问 https://medium.com/me/settings`);
                console.log(`   • 获取 Integration Token`);
                console.log(`   • 设置环境变量 MEDIUM_INTEGRATION_TOKEN`);
                console.log(`\n2. 或重新获取 Session Token:`);
                console.log(`   • 登录 Medium`);
                console.log(`   • 从浏览器获取新的 sid cookie`);
                console.log(`   • 更新环境变量 MEDIUM_SESSION_TOKEN`);
            }

            return analysis;

        } catch (error) {
            console.error('❌ 诊断过程失败:', error.message);
            throw error;
        }
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}` || 
    import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
    const apiDebugger = new MediumSimpleDebugger();
    apiDebugger.runDiagnosis().catch(console.error);
}

// 移除临时调试代码

export default MediumSimpleDebugger; 
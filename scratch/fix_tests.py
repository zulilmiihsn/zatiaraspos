import re

with open('src/tests/code-quality-tests.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace test functions catch
def replace_test_catch(match):
    name = match.group(1)
    message = match.group(2)
    return f"""				}} catch (error: unknown) {{
					const executionTime = Date.now() - startTime;
					const e = error as Error & {{ stdout?: string }};

					return {{
						name: '{name}',
						success: false,
						message: '{message}',
						details: e.stdout || e.message,
						executionTime
					}};"""

content = re.sub(r"\}\s*catch\s*\(error:\s*any\)\s*\{\s*const\s*executionTime\s*=\s*Date\.now\(\)\s*-\s*startTime;\s*return\s*\{\s*name:\s*'([^']+)',\s*success:\s*false,\s*message:\s*'([^']+)',\s*details:\s*error\.stdout\s*\|\|\s*error\.message,\s*executionTime\s*\};", replace_test_catch, content)

# For Required Files Exist, Directory Structure, Package.json Valid, Dependencies Installed (they don't use error.stdout)
def replace_simple_catch(match):
    name = match.group(1)
    message = match.group(2)
    return f"""				}} catch (error: unknown) {{
					const executionTime = Date.now() - startTime;
					const e = error as Error;

					return {{
						name: '{name}',
						success: false,
						message: '{message}',
						details: e.message,
						executionTime
					}};"""

content = re.sub(r"\}\s*catch\s*\(error:\s*any\)\s*\{\s*const\s*executionTime\s*=\s*Date\.now\(\)\s*-\s*startTime;\s*return\s*\{\s*name:\s*'([^']+)',\s*success:\s*false,\s*message:\s*'([^']+)',\s*details:\s*error\.message,\s*executionTime\s*\};", replace_simple_catch, content)

# Add interfaces
interfaces = """export interface CodeQualityTest {
	name: string;
	description: string;
	test: () => Promise<CodeQualityTestResult>;
}

export interface CodeQualityTestSuiteDef {
	name: string;
	tests: CodeQualityTest[];
}
"""
content = content.replace("export interface CodeQualityTestSuite {", interfaces + "\nexport interface CodeQualityTestSuite {")

# Type the suites
content = content.replace("export const typescriptTests =", "export const typescriptTests: CodeQualityTestSuiteDef =")
content = content.replace("export const lintingTests =", "export const lintingTests: CodeQualityTestSuiteDef =")
content = content.replace("export const fileStructureTests =", "export const fileStructureTests: CodeQualityTestSuiteDef =")
content = content.replace("export const dependencyTests =", "export const dependencyTests: CodeQualityTestSuiteDef =")

# runTestSuite any
content = content.replace("private async runTestSuite(suite: any): Promise<CodeQualityTestSuite> {", "private async runTestSuite(suite: CodeQualityTestSuiteDef): Promise<CodeQualityTestSuite> {")
content = content.replace("const results: any[] = [];", "const results: CodeQualityTestResult[] = [];")

# The catch inside runTestSuite
catch_run = """			} catch (error: unknown) {
				const e = error as Error;
				results.push({
					name: test.name,
					success: false,
					message: 'Test execution failed',
					details: e.message
				});

				console.log(`  ❌ ${test.name}: Test execution failed - ${e.message}`);
			}"""
content = re.sub(r"\}\s*catch\s*\(error:\s*any\)\s*\{\s*results\.push\(\{\s*name:\s*test\.name,\s*success:\s*false,\s*message:\s*'Test execution failed',\s*details:\s*error\.message\s*\}\);\s*console\.log\(`  ❌ \$\{test\.name\}: Test execution failed - \$\{error\.message\}`\);\s*\}", catch_run, content)

content = content.replace("results.filter((r: any)", "results.filter((r)")

with open('src/tests/code-quality-tests.ts', 'w', encoding='utf-8') as f:
    f.write(content)

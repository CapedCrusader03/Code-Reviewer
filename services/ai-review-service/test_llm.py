"""Test script to verify llm_run is being called."""
import sys
import logging
from app.llm import llm_run

# Set up logging to see output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

print("Testing llm_run function...")
print("-" * 50)

test_prompt = """Review the following code diff:
diff --git a/test.js b/test.js
+console.log('test');
"""

result = llm_run(test_prompt)

print("\nResult:")
print(f"  Quality Score: {result['quality_score']}")
print(f"  Findings Count: {len(result['findings'])}")
print(f"  PlantUML: {result['plantuml'][:50]}...")

print("\n[SUCCESS] llm_run executed successfully!")
print("Check the logs above to verify it was called.")


"""Test script for OpenAI integration.

Usage:
    # Test with stub (no API key)
    python test_openai.py
    
    # Test with OpenAI (requires API key)
    export OPENAI_API_KEY=your-key-here
    export LLM_PROVIDER=openai
    python test_openai.py
"""
import os
import sys
from app.llm import llm_run

def main():
    llm_provider = os.getenv("LLM_PROVIDER", "").lower()
    api_key = os.getenv("OPENAI_API_KEY", "")
    
    print("=" * 60)
    print("Testing LLM Integration")
    print("=" * 60)
    print(f"LLM_PROVIDER: {llm_provider or 'not set (using stub)'}")
    print(f"OPENAI_API_KEY: {'set' if api_key else 'not set (using stub)'}")
    print()
    
    test_prompt = """Review the following code diff:

diff --git a/test.js b/test.js
index 123..456
--- a/test.js
+++ b/test.js
@@ -1,1 +1,2 @@
 console.log("hello");
+console.log("world");

Please analyze this code change."""
    
    print("Calling llm_run...")
    print("-" * 60)
    
    try:
        result = llm_run(test_prompt)
        
        print("\nResult:")
        print(f"  Quality Score: {result.get('quality_score', 'N/A')}")
        print(f"  Findings Count: {len(result.get('findings', []))}")
        
        if result.get('findings'):
            print("\n  Findings:")
            for i, finding in enumerate(result['findings'], 1):
                print(f"    {i}. [{finding.get('type', 'unknown')}] {finding.get('message', '')}")
        
        print(f"\n  PlantUML: {result.get('plantuml', '')[:50]}...")
        
        print("\n" + "=" * 60)
        if llm_provider == "openai" and api_key:
            print("[SUCCESS] OpenAI integration working!")
        else:
            print("[INFO] Using stub implementation")
            print("To use OpenAI, set:")
            print("  export OPENAI_API_KEY=your-key")
            print("  export LLM_PROVIDER=openai")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()







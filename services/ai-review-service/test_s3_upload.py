"""Test S3 upload functionality."""
import sys
from app.s3_utils import upload_plantuml, ensure_bucket_exists

print("Testing S3 upload...")
print("=" * 60)

# Test bucket creation
try:
    print("1. Testing bucket creation...")
    ensure_bucket_exists()
    print("   [OK] Bucket check/creation successful")
except Exception as e:
    print(f"   [ERROR] {e}")
    sys.exit(1)

# Test PlantUML upload
try:
    print("\n2. Testing PlantUML upload...")
    test_plantuml = """@startuml
class CodeReview {
    +quality_score: int
    +findings: List
    +analyze()
}
@enduml"""
    
    s3_url = upload_plantuml(test_plantuml, job_id="test-123")
    
    if s3_url:
        print(f"   [SUCCESS] Uploaded to: {s3_url}")
        print("\n3. Verifying with AWS CLI...")
        print("   Run: aws --endpoint-url=http://localhost:4566 s3 ls s3://code-reviewer-uml/uml/")
    else:
        print("   [WARNING] Upload returned None (check LocalStack is running)")
        print("   Start LocalStack: cd infrastructure && docker-compose up -d localstack")
        
except Exception as e:
    print(f"   [ERROR] {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("Test complete!")


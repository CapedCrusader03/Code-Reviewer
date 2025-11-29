import os
import logging
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://localhost:4566")
S3_BUCKET = os.getenv("S3_BUCKET", "code-reviewer-uml")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "test")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "test")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


def get_s3_client():
    """Get S3 client configured for LocalStack or AWS."""
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION
    )


def ensure_bucket_exists(bucket_name: str = S3_BUCKET):
    """Ensure S3 bucket exists, create if it doesn't."""
    try:
        s3_client = get_s3_client()
        s3_client.head_bucket(Bucket=bucket_name)
        logger.info("Bucket %s already exists", bucket_name)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            # Bucket doesn't exist, create it
            try:
                s3_client = get_s3_client()
                s3_client.create_bucket(Bucket=bucket_name)
                logger.info("Created bucket %s", bucket_name)
            except Exception as create_error:
                logger.error("Failed to create bucket %s: %s", bucket_name, str(create_error))
                raise
        else:
            logger.error("Error checking bucket %s: %s", bucket_name, str(e))
            raise


def upload_plantuml(plantuml_text: str, job_id: str = None) -> str:
    """
    Upload PlantUML text to S3 and return the S3 URL.
    
    Args:
        plantuml_text: The PlantUML diagram text
        job_id: Optional job ID for naming the file
        
    Returns:
        S3 URL of the uploaded file, or None if upload fails
    """
    try:
        ensure_bucket_exists()
        
        # Generate unique filename
        if job_id:
            filename = f"uml/{job_id}.puml"
        else:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            filename = f"uml/{timestamp}_{unique_id}.puml"
        
        s3_client = get_s3_client()
        
        # Upload PlantUML text
        # Convert to bytes explicitly to avoid LocalStack compatibility issues
        plantuml_bytes = plantuml_text.encode('utf-8') if isinstance(plantuml_text, str) else plantuml_text
        
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=filename,
            Body=plantuml_bytes,
            ContentType='text/plain'
        )
        
        # Construct S3 URL
        if S3_ENDPOINT_URL and 'localhost' in S3_ENDPOINT_URL:
            # LocalStack URL format
            s3_url = f"{S3_ENDPOINT_URL}/{S3_BUCKET}/{filename}"
        else:
            # AWS S3 URL format
            s3_url = f"s3://{S3_BUCKET}/{filename}"
        
        logger.info("Uploaded PlantUML to S3: %s", s3_url)
        return s3_url
        
    except Exception as e:
        logger.error("Failed to upload PlantUML to S3: %s", str(e))
        return None



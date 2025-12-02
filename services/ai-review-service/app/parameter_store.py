"""
AWS SSM Parameter Store utility for AI Review Service
Retrieves secrets from Parameter Store (FREE alternative to Secrets Manager)
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def get_parameter_from_store(parameter_name: str, region: str = None) -> Optional[str]:
    """
    Retrieve a parameter from AWS SSM Parameter Store.
    
    Args:
        parameter_name: The parameter name (e.g., '/code-reviewer/gemini-api-key')
        region: AWS region (defaults to AWS_REGION env var or us-east-1)
        
    Returns:
        Parameter value or None if not found
    """
    try:
        import boto3
        
        aws_region = region or os.getenv('AWS_REGION', 'us-east-1')
        ssm = boto3.client('ssm', region_name=aws_region)
        
        response = ssm.get_parameter(Name=parameter_name)
        return response['Parameter']['Value']
    except ImportError:
        logger.warning('boto3 not installed. Cannot retrieve from Parameter Store.')
        return None
    except Exception as e:
        logger.warning(f'Failed to retrieve parameter {parameter_name} from Parameter Store: {e}')
        return None

def get_llm_api_key() -> Optional[str]:
    """
    Get LLM API key from Parameter Store or environment variable.
    
    Returns:
        API key or None
    """
    llm_provider = os.getenv('LLM_PROVIDER', '').lower()
    use_parameter_store = os.getenv('USE_PARAMETER_STORE', 'true').lower() == 'true'
    
    if llm_provider == 'gemini':
        if use_parameter_store:
            key = get_parameter_from_store('/code-reviewer/gemini-api-key')
            if key:
                return key
        return os.getenv('GEMINI_API_KEY', '')
    elif llm_provider == 'openai':
        if use_parameter_store:
            key = get_parameter_from_store('/code-reviewer/openai-api-key')
            if key:
                return key
        return os.getenv('OPENAI_API_KEY', '')
    
    return None


import os
import json
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client(service_name='s3')

INPUT_S3_BUCKET_NAME = os.environ[
    'INPUT_S3_BUCKET_NAME'
]
INPUT_S3_BUCKET_FINAL_PROMPT_KEY = os.environ[
    'INPUT_S3_BUCKET_FINAL_PROMPT_KEY'
]

def construct_invoke_model_payload_and_upload(prompt):
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 20000,
        "messages": [
            {
                "content": prompt,
                "role": "user"
            }
        ]
    }

    return json.dumps(payload)


def upload_to_s3_bucket(bucket_name, key, data):
    try:
        s3_client.put_object(Body=data, Bucket=bucket_name, Key=key)
        logger.info('Data uploaded successfully to %s/%s', bucket_name, key)
    except Exception as e:
        logger.error('Error occurred while uploading data: %s', e)
        

def lambda_handler(event, context):
    try:
        logger.info(json.dumps(event))

        prompt = event[0]['body']
        underwriting_rules = event[1]['body']

        updated_prompt = prompt.replace("\n<rules>\n</rules>", f"\n<rules>\n{underwriting_rules}\n</rules>")

        payload = construct_invoke_model_payload_and_upload(
            prompt=updated_prompt
        )
        upload_to_s3_bucket(            
            bucket_name=INPUT_S3_BUCKET_NAME, 
            key=INPUT_S3_BUCKET_FINAL_PROMPT_KEY,
            data=payload
        )

        logger.info('Payload uploaded successfully')

        return {
            'statusCode': 200,
            'body': 'SUCCESS'
        }
    except Exception as e:
        logger.error('Error occurred: %s', e)
        return {
            'statusCode': 500,
            'body': 'FAILURE'
        }
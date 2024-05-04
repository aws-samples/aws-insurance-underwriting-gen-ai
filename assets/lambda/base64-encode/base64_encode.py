import os
import json
import boto3
import base64
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client(service_name='s3')

INPUT_S3_BUCKET_NAME = os.environ[
    'INPUT_S3_BUCKET_NAME'
]
INPUT_S3_BUCKET_CLASSIFICATION_KEY = os.environ[
    'INPUT_S3_BUCKET_CLASSIFICATION_KEY'
]
INPUT_S3_BUCKET_EXTRACT_NAME_AND_LICENSE_KEY = os.environ[
    'INPUT_S3_BUCKET_EXTRACT_NAME_AND_LICENSE_KEY'
]

with open('classification.prompt') as f:
    CLASSIFICATION_PROMPT = f.read()

with open('extract_name_and_license.prompt') as f:
    EXTRACT_NAME_AND_LICENSE_PROMPT = f.read()


def construct_invoke_model_payload_and_upload(prompt, base64_data):
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 20000,
        "messages": [
            {
                "content": [
                    {
                        "source": {
                            "data": base64_data,
                            "media_type": "image/jpeg",
                            "type": "base64"
                        },
                        "type": "image"
                    },
                    {
                        "text": prompt,
                        "type": "text"
                    }
                ],
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

        bucket = event['bucket']['name']
        key = event['object']['key']

        try:
            s3_object = s3_client.get_object(Bucket=bucket, Key=key)
            object_data = s3_object['Body'].read()
            base64_data = base64.b64encode(object_data).decode('utf-8')
        except Exception as e:
            logger.error('Error occurred while getting object from S3: %s', e)
            return {
                'statusCode': 500,
                'body': 'FAILURE'
            }

        classification_prompt = construct_invoke_model_payload_and_upload(
            prompt=CLASSIFICATION_PROMPT, 
            base64_data=base64_data
        )

        extract_name_and_license_prompt = construct_invoke_model_payload_and_upload(
            prompt=EXTRACT_NAME_AND_LICENSE_PROMPT, 
            base64_data=base64_data
        )

        upload_to_s3_bucket(
            bucket_name=INPUT_S3_BUCKET_NAME, 
            key=INPUT_S3_BUCKET_CLASSIFICATION_KEY,
            data=classification_prompt
        )

        upload_to_s3_bucket(
            bucket_name=INPUT_S3_BUCKET_NAME, 
            key=INPUT_S3_BUCKET_EXTRACT_NAME_AND_LICENSE_KEY,
            data=extract_name_and_license_prompt
        )

        logger.info('Payloads uploaded successfully')

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
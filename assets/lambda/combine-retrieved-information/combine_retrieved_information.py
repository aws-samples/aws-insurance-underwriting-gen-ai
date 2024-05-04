import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    try:
        logger.info(json.dumps(event))

        retrieval_results = event['RetrievalResults']
        combined_content = ''
        for result in retrieval_results:
            combined_content += result['Content']['Text'] + ' '
    
        return {
            'statusCode': 200,
            'body': combined_content
        }
    except Exception as e:
        logger.error("Error occurred while processing the event: ", exc_info=True)
        return {
            'statusCode': 500,
            'body': 'FAILURE'
        }
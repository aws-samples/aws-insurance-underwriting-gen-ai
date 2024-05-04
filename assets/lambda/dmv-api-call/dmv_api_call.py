import json
import logging
import random

logger = logging.getLogger()
logger.setLevel(logging.INFO)

with open('underwriting_validation.prompt') as f:
    UNDERWRITING_VALIDATION_PROMPT = f.read()

VIOLATIONS = [
    "speeding",
    "reckless_driving",
    "failure_to_stop",
    "driving_under_influence",
    "no_valid_license",
    "no_insurance",
    "expired_registration",
    "improper_lane_change",
    "running_red_light",
    "distracted_driving"
]

def generate_random_dmv_record(license_id):
    # Future update - make API call against DMV database to get real data
    # make_api_call(license_id)
    num_violations = random.randint(0, 3)
    violations = random.sample(VIOLATIONS, num_violations)
    if len(violations) == 0:
        violations = ["none"]
    dmv_record = {
        "license_status": random.choice(["full_license", "learners_permit"]),
        "violations": violations,
    }
    return dmv_record

def append_dmv_record_to_prompt(dmv_record, prompt):
    driver_info = []
    for key, value in dmv_record.items():
        if isinstance(value, list):
            value = ",".join(value)
        elif isinstance(value, bool):
            value = str(value)
        driver_info.append(f"{key}:{value}")

    driver_info_str = ",".join(driver_info)
    updated_prompt = prompt.replace("\n<driver>\n</driver>", f"\n<driver>\n{driver_info_str}\n</driver>")

    return updated_prompt

def lambda_handler(event, context):
    try:
        logger.info(json.dumps(event))

        first_name = event['Body']['content'][0]['text'].split(',')[0].split(':')[1].strip()
        last_name = event['Body']['content'][0]['text'].split(',')[1].split(':')[1].strip()
        license_id = event['Body']['content'][0]['text'].split(',')[2].split(':')[1].strip()

        logger.info(f"First Name: {first_name}, Last Name: {last_name}, License ID: {license_id}")

        random_dmv_record = generate_random_dmv_record(license_id)
        underwriting_prompt = append_dmv_record_to_prompt(random_dmv_record, UNDERWRITING_VALIDATION_PROMPT)

        return {
            'statusCode': 200,
            'body': underwriting_prompt
        }
    except Exception as e:
        logger.error("Error occurred while processing the event: ", exc_info=True)
        return {
            'statusCode': 500,
            'body': 'An error occurred while processing your request.'
        }

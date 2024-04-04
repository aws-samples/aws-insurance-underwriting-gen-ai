FROM public.ecr.aws/sam/build-python3.12:1

RUN mkdir /asset
RUN pip install poetry
COPY . .
RUN rm -rf dist/*
RUN poetry install
RUN poetry build
RUN poetry run pip install --upgrade -t /asset dist/*.whl

CMD ["echo", "Build completed"]
# explicit platform info prevents from build issues on different systems
# used to troubleshoot handler overwrite
# .dockerignore is used to prevent copying of node modules to the container 
FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:20 AS builder

WORKDIR ${LAMBDA_TASK_ROOT}

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:20

COPY --from=builder ${LAMBDA_TASK_ROOT}/dist/index.js ${LAMBDA_TASK_ROOT}/
COPY --from=builder ${LAMBDA_TASK_ROOT}/node_modules ${LAMBDA_TASK_ROOT}/node_modules

CMD [ "index.handler" ]

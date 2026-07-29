FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# .git is dockerignored — pass sha from host at build time.
ARG APP_GIT_SHA=unknown
ENV APP_GIT_SHA=$APP_GIT_SHA

RUN npm run build

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist/ ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

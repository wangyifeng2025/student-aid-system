# syntax=docker/dockerfile:1

FROM golang:1.23-alpine3.21 AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /src

ENV GOTOOLCHAIN=auto
ENV CGO_ENABLED=0
ENV GOOS=linux
# 国内构建加速：Go 模块与 checksum 走 goproxy.cn（见 https://goproxy.cn ）
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.google.cn
ENV GOPROXY=${GOPROXY}
ENV GOSUMDB=${GOSUMDB}

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server \
  && go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata wget \
  && addgroup -S app && adduser -S app -G app

ENV TZ=Asia/Shanghai

WORKDIR /app

COPY --from=builder /out/server /out/seed /app/
COPY config/config.yaml /app/config/
COPY assets/ /app/assets/
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/uploads \
  && chown -R app:app /app

USER app

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["server"]

.PHONY: run build tidy fmt vet test clean seed

APP_NAME := server
BIN_DIR := bin

run:
	go run ./cmd/server

seed:
	go run ./cmd/seed

build:
	@mkdir -p $(BIN_DIR)
	go build -o $(BIN_DIR)/$(APP_NAME) ./cmd/server

tidy:
	go mod tidy

fmt:
	go fmt ./...

vet:
	go vet ./...

test:
	go test ./...

clean:
	rm -rf $(BIN_DIR)

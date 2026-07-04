package config

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config 应用全局配置
type Config struct {
	App      AppConfig      `mapstructure:"app"`
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	Upload   UploadConfig   `mapstructure:"upload"`
	Export   ExportConfig   `mapstructure:"export"`
}

type AppConfig struct {
	Name string `mapstructure:"name"`
	Env  string `mapstructure:"env"` // dev / test / prod
}

type ServerConfig struct {
	Port int `mapstructure:"port"`
}

type DatabaseConfig struct {
	Driver   string `mapstructure:"driver"` // postgres / mysql
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	Name     string `mapstructure:"name"`
	Params   string `mapstructure:"params"`
}

type JWTConfig struct {
	Secret             string `mapstructure:"secret"`
	ExpireHours        int    `mapstructure:"expire_hours"`
	RefreshExpireHours int    `mapstructure:"refresh_expire_hours"`
	Issuer             string `mapstructure:"issuer"`
}

type UploadConfig struct {
	Dir         string `mapstructure:"dir"`
	MaxSizeMB   int    `mapstructure:"max_size_mb"`
	AllowedExts string `mapstructure:"allowed_exts"`
}

// ExportConfig 导出相关配置。
type ExportConfig struct {
	// PDFFontPath 指向一个支持中文的 TTF 字体文件，用于助学金申请表等 fpdf 导出
	// （未配置时该类导出接口会返回明确的提示）。
	PDFFontPath string `mapstructure:"pdf_font_path"`
	// SchoolName 认定表表头学校名称（可按本校修改）。
	SchoolName string `mapstructure:"school_name"`
	// RecognitionTemplatePath 认定申请表 Word 模板（docx，含 {占位符}），
	// 认定通过后导出 docx 时使用。
	RecognitionTemplatePath string `mapstructure:"recognition_template_path"`
}

// Load 从 config/config.yaml 及环境变量加载配置。
// 环境变量前缀 SAS_，如 SAS_DATABASE_PASSWORD 覆盖 database.password。
//
// 配置查找会从当前工作目录向上定位项目根（包含 go.mod 的目录），
// 因此在任意子目录（如执行 `go test ./internal/database/`）运行时仍能读到
// 项目根的 config/config.yaml 与 .env，避免回退到默认值。
//
// 加载优先级（高 -> 低）：进程已有环境变量 > .env > config.yaml > 内置默认值。
func Load() (*Config, error) {
	root := findProjectRoot()

	// 加载 .env（godotenv 默认不覆盖已存在的环境变量）。
	if root != "" {
		_ = godotenv.Load(filepath.Join(root, ".env"))
	}
	_ = godotenv.Load() // 兼容当前目录下的 .env

	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	if root != "" {
		v.AddConfigPath(filepath.Join(root, "config"))
		v.AddConfigPath(root)
	}
	v.AddConfigPath("./config")
	v.AddConfigPath(".")

	setDefaults(v)

	v.SetEnvPrefix("SAS")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		// 没有配置文件时仅使用默认值 + 环境变量
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// findProjectRoot 从当前工作目录逐级向上查找包含 go.mod 的目录，
// 找不到时返回空字符串。
func findProjectRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("app.name", "student-aid-system")
	v.SetDefault("app.env", "dev")
	v.SetDefault("server.port", 8080)

	v.SetDefault("database.driver", "postgres")
	v.SetDefault("database.host", "127.0.0.1")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "postgres")
	v.SetDefault("database.password", "postgres")
	v.SetDefault("database.name", "student_aid_db")
	v.SetDefault("database.params", "sslmode=disable TimeZone=Asia/Shanghai")

	v.SetDefault("jwt.secret", "change-me-in-production")
	v.SetDefault("jwt.expire_hours", 24)
	v.SetDefault("jwt.refresh_expire_hours", 168)
	v.SetDefault("jwt.issuer", "student-aid-system")

	v.SetDefault("upload.dir", "./uploads")
	v.SetDefault("upload.max_size_mb", 20)
	v.SetDefault("upload.allowed_exts", ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx")

	v.SetDefault("export.pdf_font_path", "")
	v.SetDefault("export.school_name", "黔西南民族职业技术学院")
	v.SetDefault("export.recognition_template_path", "./assets/templates/recognition_application.docx")
}

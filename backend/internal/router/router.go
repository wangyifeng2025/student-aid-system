package router

import (
	"github.com/gin-gonic/gin"
	"github.com/wangyifeng2025/student-aid-system/internal/config"
	"github.com/wangyifeng2025/student-aid-system/internal/handler"
	"github.com/wangyifeng2025/student-aid-system/internal/middleware"
	"github.com/wangyifeng2025/student-aid-system/internal/model"
	"github.com/wangyifeng2025/student-aid-system/pkg/jwt"
	"gorm.io/gorm"
)

// New 构建 Gin 引擎与路由。
func New(cfg *config.Config, db *gorm.DB) *gin.Engine {
	if cfg.App.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}

	jwtMgr := jwt.NewManager(
		cfg.JWT.Secret,
		cfg.JWT.Issuer,
		cfg.JWT.ExpireHours,
		cfg.JWT.RefreshExpireHours,
	)
	h := handler.New(db, cfg, jwtMgr)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery(), middleware.CORS())

	r.GET("/health", h.Health)

	api := r.Group("/api/v1")
	{
		// 公开认证端点
		authPublic := api.Group("/auth")
		{
			authPublic.POST("/login", h.Login)
			authPublic.POST("/refresh", h.Refresh)
			authPublic.POST("/recover-password", h.RecoverPassword)
		}

		// 需要认证的端点
		secured := api.Group("")
		secured.Use(middleware.JWTAuth(jwtMgr), middleware.LoadCurrentUser(db))
		{
			secured.GET("/me", h.Me)
			secured.GET("/dashboard", h.DashboardOverview)
			secured.GET("/students/me", h.GetMyStudent)

			authSecured := secured.Group("/auth")
			{
				authSecured.PUT("/password", h.ChangePassword)
				authSecured.POST("/admin/reset-password",
					middleware.RequireRoles(model.RoleAdmin),
					h.AdminResetPassword,
				)
			}

			adminOnly := secured.Group("")
			adminOnly.Use(middleware.RequireRoles(model.RoleAdmin))

			// 模块 2：组织机构与字典 — 读取全员可读，写入仅管理员。
			registerOrgRoutes(secured, adminOnly, h)
			registerDictRoutes(secured, adminOnly, h)
			registerRegionCodeRoutes(secured, adminOnly, h)

			// 模块 3：学生与重点人群 — 仍仅管理员。
			registerStudentRoutes(adminOnly, h)
			registerImportRoutes(adminOnly, h)

			// 模块 10：用户管理 — 仅管理员。
			registerUserRoutes(adminOnly, h)

			// 模块 4：困难认定申请。所有登录角色可访问，
			// 具体读写权限由 service 按角色 + 数据范围（本人/本班/本系/全校）控制。
			registerRecognitionRoutes(secured, h)

			// 模块 5：三级评审与退回。仅评审角色与管理员，
			// 具体级别/数据范围由 service 控制。
			reviewerOnly := secured.Group("")
			reviewerOnly.Use(middleware.RequireRoles(
				model.RoleClassAdvisor,
				model.RoleDepartment,
				model.RoleAidCenter,
				model.RoleAdmin,
			))
			registerReviewRoutes(reviewerOnly, h)
			registerGrantRoutes(secured, h)
			registerGrantReviewRoutes(reviewerOnly, h)
		}
	}

	return r
}

func registerGrantRoutes(g *gin.RouterGroup, h *handler.Handler) {
	grants := g.Group("/grants")
	{
		grants.GET("", h.ListGrants)
		grants.POST("", h.CreateGrant)
		grants.GET("/:id", h.GetGrant)
		grants.PUT("/:id", h.UpdateGrant)
		grants.DELETE("/:id", h.DeleteGrant)
		grants.POST("/:id/submit", h.SubmitGrant)
		grants.GET("/:id/export", h.ExportGrantPDF)
	}
}

func registerGrantReviewRoutes(g *gin.RouterGroup, h *handler.Handler) {
	reviews := g.Group("/grant-reviews")
	{
		reviews.GET("/todo", h.ListGrantReviewTodo)
		reviews.GET("/records", h.ListGrantReviewRecords)
		reviews.GET("/:id", h.GetGrantReviewDetail)
		reviews.POST("/:id/pass", h.PassGrantReview)
		reviews.POST("/:id/reject", h.RejectGrantReview)
		reviews.POST("/:id/withdraw", h.WithdrawGrantReview)
	}
}

// registerOrgRoutes 挂载组织机构路由：read 组全员可读，write 组仅管理员。
func registerOrgRoutes(read, write *gin.RouterGroup, h *handler.Handler) {
	readOrgs := read.Group("/orgs")
	{
		readOrgs.GET("/departments", h.ListDepartments)
		readOrgs.GET("/majors", h.ListMajors)
		readOrgs.GET("/grades", h.ListGrades)
		readOrgs.GET("/classes", h.ListClasses)
	}
	writeOrgs := write.Group("/orgs")
	{
		writeOrgs.POST("/departments", h.CreateDepartment)
		writeOrgs.PUT("/departments/:id", h.UpdateDepartment)
		writeOrgs.DELETE("/departments/:id", h.DeleteDepartment)

		writeOrgs.POST("/majors", h.CreateMajor)
		writeOrgs.PUT("/majors/:id", h.UpdateMajor)
		writeOrgs.DELETE("/majors/:id", h.DeleteMajor)

		writeOrgs.POST("/grades", h.CreateGrade)
		writeOrgs.PUT("/grades/:id", h.UpdateGrade)
		writeOrgs.DELETE("/grades/:id", h.DeleteGrade)

		writeOrgs.POST("/classes", h.CreateClass)
		writeOrgs.PUT("/classes/:id", h.UpdateClass)
		writeOrgs.DELETE("/classes/:id", h.DeleteClass)
	}
}

// registerDictRoutes 挂载数据字典路由：read 组全员可读，write 组仅管理员。
func registerDictRoutes(read, write *gin.RouterGroup, h *handler.Handler) {
	readDicts := read.Group("/dicts")
	{
		readDicts.GET("", h.ListDictTypes)
		readDicts.GET("/:type", h.ListDictByType)
	}
	writeDicts := write.Group("/dicts")
	{
		writeDicts.POST("/:type", h.CreateDict)
		writeDicts.PUT("/:type/:code", h.UpdateDict)
		writeDicts.DELETE("/:type/:code", h.DeleteDict)
	}
}

// registerRegionCodeRoutes 行政区划：读取全员可读，写入仅管理员。
func registerRegionCodeRoutes(read, write *gin.RouterGroup, h *handler.Handler) {
	readRegs := read.Group("/region-codes")
	{
		readRegs.GET("", h.ListRegionCodes)
		readRegs.GET("/lookup", h.LookupRegionCode)
		readRegs.GET("/:code", h.GetRegionCode)
	}
	writeRegs := write.Group("/region-codes")
	{
		writeRegs.POST("", h.CreateRegionCode)
		writeRegs.POST("/import", h.ImportRegionCodes)
		writeRegs.POST("/import-default", h.ImportDefaultRegionCodes)
		writeRegs.PUT("/:code", h.UpdateRegionCode)
		writeRegs.DELETE("/:code", h.DeleteRegionCode)
	}
}

// registerStudentRoutes 挂载学生与重点人群管理路由（仅管理员）。
func registerStudentRoutes(g *gin.RouterGroup, h *handler.Handler) {
	students := g.Group("/students")
	{
		students.GET("", h.ListStudents)
		students.GET("/:id", h.GetStudent)
		students.POST("", h.CreateStudent)
		students.PUT("/:id", h.UpdateStudent)
		students.DELETE("/:id", h.DeleteStudent)
	}

	sg := g.Group("/special-groups")
	{
		sg.GET("", h.ListSpecialGroups)
		sg.GET("/:id", h.GetSpecialGroup)
		sg.POST("", h.CreateSpecialGroup)
		sg.PUT("/:id", h.UpdateSpecialGroup)
		sg.DELETE("/:id", h.DeleteSpecialGroup)
	}
}

// registerRecognitionRoutes 挂载困难认定申请与其附件路由（登录可访问，权限在 service 内控制）。
func registerRecognitionRoutes(g *gin.RouterGroup, h *handler.Handler) {
	recs := g.Group("/recognitions")
	{
		recs.GET("", h.ListRecognitions)
		recs.POST("", h.CreateRecognition)
		recs.GET("/summary-export", h.ExportRecognitionSummary)
		recs.GET("/:id", h.GetRecognition)
		recs.PUT("/:id", h.UpdateRecognition)
		recs.DELETE("/:id", h.DeleteRecognition)
		recs.POST("/:id/submit", h.SubmitRecognition)
		recs.POST("/:id/withdraw", h.WithdrawRecognition)
		recs.GET("/:id/export", h.ExportRecognitionDocx)
		recs.POST("/:id/attachments", h.UploadRecognitionAttachment)
		recs.GET("/:id/attachments", h.ListRecognitionAttachments)
	}

	atts := g.Group("/attachments")
	{
		atts.GET("/:id/download", h.DownloadAttachment)
		atts.DELETE("/:id", h.DeleteAttachment)
	}
}

// registerUserRoutes 挂载用户管理路由（仅管理员）。
func registerUserRoutes(g *gin.RouterGroup, h *handler.Handler) {
	users := g.Group("/users")
	{
		users.GET("", h.ListUsers)
		users.GET("/:id", h.GetUser)
		users.POST("", h.CreateUser)
		users.PUT("/:id", h.UpdateUser)
		users.DELETE("/:id", h.DeleteUser)
		users.POST("/:id/reset-password", h.ResetUserPassword)
	}
}

// registerReviewRoutes 挂载三级评审与退回路由（评审角色与管理员）。
func registerReviewRoutes(g *gin.RouterGroup, h *handler.Handler) {
	reviews := g.Group("/reviews")
	{
		reviews.GET("/todo", h.ListReviewTodo)
		reviews.GET("/records", h.ListReviewRecords)
		reviews.POST("/batch", h.BatchReview)
		reviews.GET("/:id", h.GetReviewDetail)
		reviews.POST("/:id/pass", h.PassReview)
		reviews.POST("/:id/reject", h.RejectReview)
		reviews.POST("/:id/withdraw", h.WithdrawReview)
	}
}

// registerImportRoutes 挂载 Excel 导入与模板下载路由（仅管理员）。
func registerImportRoutes(g *gin.RouterGroup, h *handler.Handler) {
	imp := g.Group("/import")
	{
		imp.GET("/template/:type", h.DownloadImportTemplate)
		imp.POST("/students", h.ImportStudents)
		imp.POST("/special-groups", h.ImportSpecialGroups)
		imp.POST("/departments", h.ImportDepartments)
		imp.POST("/majors", h.ImportMajors)
		imp.POST("/grades", h.ImportGrades)
		imp.POST("/classes", h.ImportClasses)
	}
	exp := g.Group("/export")
	{
		exp.GET("/students", h.ExportStudents)
		exp.GET("/:type", h.ExportOrg)
	}
}

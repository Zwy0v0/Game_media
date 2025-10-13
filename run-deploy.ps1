# 简化的PowerShell运行脚本
# 使用方法: .\run-deploy.ps1

Write-Host "🚀 开始运行游戏媒体应用部署..." -ForegroundColor Green

# 检查PowerShell执行策略
$executionPolicy = Get-ExecutionPolicy
if ($executionPolicy -eq "Restricted") {
    Write-Host "⚠️ PowerShell执行策略受限，需要设置为RemoteSigned或Unrestricted" -ForegroundColor Yellow
    Write-Host "请以管理员身份运行PowerShell，然后执行:" -ForegroundColor Yellow
    Write-Host "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Cyan
    exit 1
}

# 运行部署脚本
try {
    & ".\deploy-phase1.ps1" -Profile "Game_media"
} catch {
    Write-Host "❌ 部署过程中出现错误: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "请检查AWS CLI配置和网络连接" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 部署脚本执行完成" -ForegroundColor Green




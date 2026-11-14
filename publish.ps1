param([string]$RepositoryName = 'brawl-draft', [string]$GhPath = 'gh')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Assert-LastExit([string]$Step) { if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)." } }
& $GhPath auth status
if ($LASTEXITCODE -ne 0) { & $GhPath auth login --web --git-protocol https; Assert-LastExit 'GitHub login' }
$githubLogin = (& $GhPath api user --jq '.login').Trim()
Assert-LastExit 'Read account'
& $GhPath repo view "$githubLogin/$RepositoryName" --json name 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "Repository $githubLogin/$RepositoryName already exists. Choose another -RepositoryName to avoid overwriting it." }
node scripts/build.mjs
Assert-LastExit 'Build'
node --test tests/engine.test.mjs
Assert-LastExit 'Tests'
if (Test-Path -LiteralPath '.git') { throw 'This directory already contains a Git repository. Publish through your existing remote instead.' }
git init -b main
Assert-LastExit 'Git init'
git config user.name $githubLogin
git config user.email "$githubLogin@users.noreply.github.com"
git add . ':!.github'
git commit -m 'Build Brawl Draft website'
Assert-LastExit 'Commit'
& $GhPath repo create "$githubLogin/$RepositoryName" --public --source . --remote origin --description '荒野乱斗 BP 模拟器、英雄地图数据库与个人英雄池'
Assert-LastExit 'Create repository'
& $GhPath auth setup-git --hostname github.com
Assert-LastExit 'Configure GitHub credential helper'
git push -u origin main
Assert-LastExit 'Push source'
$pagesCheckout = Join-Path $PSScriptRoot 'work/pages-publish'
if (Test-Path -LiteralPath $pagesCheckout) { throw 'work/pages-publish already exists. Use a fresh checkout to publish.' }
New-Item -ItemType Directory -Path $pagesCheckout -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'dist') -Force | Copy-Item -Destination $pagesCheckout -Recurse
git -C $pagesCheckout init -b gh-pages
git -C $pagesCheckout config user.name $githubLogin
git -C $pagesCheckout config user.email "$githubLogin@users.noreply.github.com"
git -C $pagesCheckout add .
git -C $pagesCheckout commit --quiet -m 'Publish Brawl Draft static website'
git -C $pagesCheckout remote add origin "https://github.com/$githubLogin/$RepositoryName.git"
git -C $pagesCheckout push -u origin gh-pages
Assert-LastExit 'Push Pages branch'
& $GhPath api --method POST "repos/$githubLogin/$RepositoryName/pages" -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/'
Assert-LastExit 'Enable Pages'
& $GhPath api --method POST "repos/$githubLogin/$RepositoryName/pages/builds"
Assert-LastExit 'Start deployment'
Write-Host "Deployment started. Track it at https://github.com/$githubLogin/$RepositoryName/actions"
Write-Host "The public URL will appear under Settings > Pages after deployment succeeds."

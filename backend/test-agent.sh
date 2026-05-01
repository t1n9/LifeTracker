#!/bin/bash
# Agent 自动化测试脚本
# 用法: bash test-agent.sh <TOKEN>

TOKEN=$1
BASE="http://localhost:3002/api"
PASS=0
FAIL=0
RESULTS=()

chat() {
  local msg="$1"
  curl -s -X POST "$BASE/agent/chat" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\": $(echo "$msg" | python -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))'), \"confirmMode\": false}"
}

check() {
  local label="$1"
  local response="$2"
  local expect_tool="$3"   # 期望 toolResults 中包含此工具名
  local expect_text="$4"   # 期望回复包含此文字（可选）

  local tools=$(echo "$response" | python -c "
import sys, json
try:
  d = json.load(sys.stdin)
  tr = d.get('toolResults', [])
  print(','.join([t.get('tool','') for t in tr]))
except: print('')
" 2>/dev/null)

  local reply=$(echo "$response" | python -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print(d.get('reply',''))
except: print('')
" 2>/dev/null)

  local ok=1
  if [ -n "$expect_tool" ] && [[ "$tools" != *"$expect_tool"* ]]; then
    ok=0
  fi
  if [ -n "$expect_text" ] && [[ "$reply" != *"$expect_text"* ]]; then
    ok=0
  fi

  if [ $ok -eq 1 ]; then
    PASS=$((PASS+1))
    RESULTS+=("✅ $label | tools=$tools")
  else
    FAIL=$((FAIL+1))
    RESULTS+=("❌ $label | expect_tool=$expect_tool | actual_tools=$tools | reply_snippet=${reply:0:80}")
  fi
}

echo "========================================"
echo " LifeTracker Agent 自动化测试"
echo "========================================"
echo ""

# ── 场景1: 起床 + 任务列表（最经典的晨间输入）
echo "[1/12] 起床 + 任务列表..."
R=$(chat "今天7:30起床，今天任务是数学套卷+英语阅读+晚上跑步")
check "起床+任务" "$R" "start_day" ""
check "起床+任务→create_tasks" "$R" "create_tasks" ""
sleep 2

# ── 场景2: 纯起床时间
echo "[2/12] 纯起床时间..."
R=$(chat "7点半起床")
check "纯起床时间→start_day" "$R" "start_day" ""
sleep 2

# ── 场景3: 直接开番茄（无任务名）
echo "[3/12] 直接开番茄无任务名..."
R=$(chat "开启一个25分钟番茄钟")
check "简单番茄→start_pomodoro" "$R" "start_pomodoro" ""
sleep 2

# ── 场景4: 开番茄 + 任务名（任务大概率不存在，应 createTaskIfMissing）
echo "[4/12] 开番茄带任务名（新任务）..."
R=$(chat "现在做行政法复习，开启1小时番茄")
check "番茄+新任务→start_pomodoro" "$R" "start_pomodoro" ""
sleep 2

# ── 场景5: 记录跑步
echo "[5/12] 记录跑步..."
R=$(chat "刚跑了5公里")
check "跑步→record_exercise" "$R" "record_exercise" ""
sleep 2

# ── 场景6: 记录跑步 + 运动感受
echo "[6/12] 跑步+感受..."
R=$(chat "今天跑了3公里，状态非常棒")
check "跑步+感受→record_exercise" "$R" "record_exercise" ""
check "跑步+感受→set_exercise_feeling" "$R" "set_exercise_feeling" ""
sleep 2

# ── 场景7: 运动+感受+番茄（三合一）
echo "[7/12] 运动+感受+番茄（三合一）..."
R=$(chat "今天跑了3公里，状态非常棒。现在做行政法，帮我开2小时番茄")
check "三合一→record_exercise" "$R" "record_exercise" ""
check "三合一→set_exercise_feeling" "$R" "set_exercise_feeling" ""
check "三合一→start_pomodoro" "$R" "start_pomodoro" ""
sleep 2

# ── 场景8: 记录餐饮
echo "[8/12] 记录午餐..."
R=$(chat "午饭花了28元")
check "午饭→record_meal_expense" "$R" "record_meal_expense" ""
sleep 2

# ── 场景9: 完成任务
echo "[9/12] 完成任务..."
R=$(chat "数学套卷完成了")
check "完成任务→complete_task" "$R" "complete_task" ""
sleep 2

# ── 场景10: 查今日任务
echo "[10/12] 查今日任务..."
R=$(chat "今天的任务有哪些")
check "查今日任务→get_today_tasks" "$R" "get_today_tasks" ""
sleep 2

# ── 场景11: 拒绝域外请求
echo "[11/12] 拒绝域外请求..."
R=$(chat "帮我写一段Python代码排序列表")
TOOLS=$(echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); print(','.join([t.get('tool','') for t in d.get('toolResults',[])]))" 2>/dev/null)
REPLY=$(echo "$R" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('reply',''))" 2>/dev/null)
if [ -z "$TOOLS" ] && [[ "$REPLY" == *"抱歉"* || "$REPLY" == *"无法"* || "$REPLY" == *"只能"* ]]; then
  PASS=$((PASS+1))
  RESULTS+=("✅ 拒绝域外请求 | 正确拒绝，未调用工具")
else
  FAIL=$((FAIL+1))
  RESULTS+=("❌ 拒绝域外请求 | tools=$TOOLS | reply=${REPLY:0:80}")
fi
sleep 2

# ── 场景12: 今日复盘
echo "[12/12] 今日复盘..."
R=$(chat "帮我写一下今天的复盘总结")
check "复盘→update_day_reflection" "$R" "update_day_reflection" ""
sleep 2

# ── 汇总
echo ""
echo "========================================"
echo " 测试结果汇总"
echo "========================================"
for r in "${RESULTS[@]}"; do
  echo "$r"
done
echo ""
echo "通过: $PASS / $((PASS+FAIL))"
echo "失败: $FAIL / $((PASS+FAIL))"

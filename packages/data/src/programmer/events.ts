import type { Event, EventEffect } from '../event.types'
import type { Age } from '../age.types'
import { attachDecisions } from './decisions'

export const CareerQuarters = 36
export const endings = new Map([
    [
        20901,
        {
            name: '技术专家',
            description:
                '你把复杂问题拆成清晰的系统，也成为了同事愿意请教的人。',
        },
    ],
    [
        20902,
        {
            name: '团队领航员',
            description:
                '从写好自己的代码，到让一群人把事情做好。你的下一行代码，是团队。',
        },
    ],
    [
        20903,
        {
            name: '自由开发者',
            description:
                '积累的作品与储备给了你选择权。你开始按自己的节奏接项目、做产品。',
        },
    ],
    [
        20904,
        {
            name: '生活架构师',
            description:
                '你交付了工作，也认真经营了生活。健康、爱好和代码，都有自己的位置。',
        },
    ],
    [
        20905,
        {
            name: '可靠的工程师',
            description:
                '没有传说中的一夜成名，只有一次次值得信任的交付。这也是很好的职业答案。',
        },
    ],
    [
        20906,
        {
            name: '暂停，是为了重启',
            description:
                '你决定离开高压环境，先照顾好自己。职业生涯可以暂停，人生还有其他分支。',
        },
    ],
])
const items: Event[] = []
function add(
    id: number,
    event: string,
    effect?: EventEffect,
    extra: Partial<Event> = {},
) {
    items.push({ id, event, grade: 0, effect, ...extra })
}
add(20000, '你带着电脑和一份新合同报到。工牌领取成功，程序员生涯正式启动。', {
    SPR: 1,
})
add(
    20001,
    '你提交了第一个 Pull Request。三轮 review 之后，绿色的 Merge 按钮终于亮了。',
    { INT: 1, SPR: 1 },
)
add(
    20002,
    '试用期答辩开始。你打开这几个月的项目记录，向团队展示自己的成果。',
    undefined,
    {
        branch: [
            { condition: 'INT>=7', event: 20801 },
            { condition: 'CHR>=7', event: 20802 },
            { condition: 'AGE>=0', event: 20803 },
        ],
    },
)
add(
    20801,
    '你讲清了技术方案与取舍，顺利转正。导师说，下个项目可以让你独立负责。',
    { MNY: 2, SPR: 2 },
    { NoRandom: true, grade: 1 },
)
add(
    20802,
    '你把协作过程和业务价值讲得很清楚，顺利转正。你的沟通能力被团队记住了。',
    { CHR: 1, MNY: 1, SPR: 2 },
    { NoRandom: true, grade: 1 },
)
add(
    20803,
    '基础还有短板。你和导师制定了补习计划，延长一个月试用后终于转正。',
    { INT: 1, SPR: -1 },
    { NoRandom: true },
)
add(
    20101,
    '你读懂了项目里最古老的模块。注释写着“临时方案”，提交日期却是五年前。',
    { INT: 1 },
)
add(20102, '接口联调出现偏差。你画了一张时序图，和前后端同事一起对齐了约定。', {
    CHR: 1,
    INT: 1,
})
add(20103, '你为重复操作写了一个小脚本。省下的半小时，刚好够准时下班。', {
    INT: 1,
    SPR: 1,
})
add(
    20104,
    '第一次值班遇上告警。你按应急手册回滚，系统恢复了，心跳却还没恢复。',
    { INT: 2, STR: -1, SPR: -1 },
)
add(20105, '你把 Bug 的复现步骤补全，测试同事第一次给你发来了大拇指。', {
    CHR: 1,
    SPR: 1,
})
add(
    20106,
    '上线后发现一处边界遗漏。你补上回归测试，也记住了不要只测正常路径。',
    { INT: 1, SPR: -1 },
)
add(20107, '你加入公司的羽毛球小组。晚上没有打开 IDE，反而睡得格外踏实。', {
    STR: 1,
    SPR: 1,
})
add(20108, '通勤花掉太多时间。你搬到公司附近，钱包瘪了一点，睡眠多了一点。', {
    MNY: -1,
    STR: 1,
})
add(
    20109,
    '你的技术分享把缓存问题讲得很明白。认真准备的内容真的帮到了别人。',
    { CHR: 1, SPR: 1 },
    { include: 'INT>=7', grade: 1 },
)
add(
    20110,
    '团队请你主持需求澄清。模糊的“优化一下”终于变成了可以验收的清单。',
    { CHR: 1, MNY: 1 },
    { include: 'CHR>=7', grade: 1 },
)
add(20111, '你下班后做了一个小作品，写进简历。从设计到部署都由你独立完成。', {
    INT: 1,
    SPR: 1,
})
add(20112, '本季项目平稳交付。你把第一笔奖金存起来，觉得生活开始有了缓冲。', {
    MNY: 2,
})
add(
    20201,
    '一次慢查询排查，从执行计划一路追到索引设计。性能曲线终于降了下来。',
    { INT: 2 },
    { include: 'INT>=8' },
)
add(
    20202,
    '产品临时调整需求。你先确认优先级，再把交付拆成两期，避免了全员通宵。',
    { CHR: 2, SPR: 1 },
    { include: 'CHR>=8' },
)
add(20203, '你给历史代码补测试。进度看起来很慢，但后来的每次重构都更安心。', {
    INT: 1,
    SPR: 1,
})
add(20204, '季度冲刺连着几个晚班。项目上线了，你开始考虑这种节奏能持续多久。', {
    MNY: 2,
    STR: -1,
    SPR: -1,
})
add(20205, '你和同事做了一次结对编程。一个下午，解决了独自卡了三天的问题。', {
    INT: 1,
    CHR: 1,
})
add(
    20206,
    '你订好健身时间，并把它当作不可随意取消的日程。今天的提交到此为止。',
    { STR: 2, SPR: 1 },
)
add(
    20207,
    '房租上涨，生活开销多了一笔。你重新整理预算，没有靠冲动消费安慰自己。',
    { MNY: -1 },
)
add(
    20208,
    '你给开源项目提交的修复被合并了。维护者认真写了一句：Thanks for your contribution。',
    { INT: 2, CHR: 1, SPR: 1 },
    { include: 'INT>=10', exclude: 'EVT?[20208]', grade: 2 },
)
add(
    20209,
    '绩效沟通里，你用数据说明了项目价值。努力终于从“感觉不错”变成了明确的认可。',
    { MNY: 2, SPR: 1 },
    { include: 'CHR>=9', grade: 1 },
)
add(
    20210,
    '新同事来请教环境配置。你整理了一份上手文档，省下了大家反复踩坑的时间。',
    { CHR: 1 },
)
add(
    20211,
    '你经历了一次线上复盘。团队讨论流程缺口，没有把事故简单归咎于某个人。',
    { INT: 1, SPR: 1 },
)
add(20212, '猎头发来消息。你没有立刻行动，只把近两年的成果更新进了简历。', {
    CHR: 1,
    SPR: 1,
})
add(
    20301,
    '你主导了一次架构评审。比起堆新技术，你更在意复杂度到底值不值得。',
    { INT: 2, CHR: 1 },
    { include: 'INT>=13', grade: 1 },
)
add(
    20302,
    '带新人占用了不少时间。直到他独立修好一个问题，你才体会到传递经验的意义。',
    { CHR: 2, SPR: 1 },
)
add(20303, '业务进入稳定期。你推动了一轮技术债清理，值班告警明显少了。', {
    INT: 1,
    STR: 1,
})
add(20304, '公司组织调整，熟悉的项目换了负责人。你花了一季重新建立协作关系。', {
    CHR: 1,
    SPR: -1,
})
add(
    20305,
    '老同事推荐了一个机会。技术积累和合作口碑，成了比海投更好的敲门砖。',
    { MNY: 3, SPR: 1 },
    { include: '(INT>=12)&(CHR>=9)', grade: 1 },
)
add(
    20306,
    '你终于用完年假。远离消息通知的几天里，你重新找到了对日常生活的感受。',
    { STR: 2, SPR: 2, MNY: -1 },
)
add(20307, '新框架又上了热榜。你先做了小规模验证，最后决定暂时维持成熟方案。', {
    INT: 1,
    SPR: 1,
})
add(
    20308,
    '跨部门合作卡在了责任边界。你把目标与分工写下来，会议终于有了结论。',
    { CHR: 2 },
)
add(
    20309,
    '独立产品收到了第一笔付款。金额不大，却让你看见了工作之外的可能。',
    { MNY: 3, SPR: 2 },
    { include: '(INT>=12)&(MNY>=8)', exclude: 'EVT?[20309]', grade: 2 },
)
add(20310, '体检提醒你，久坐并不是小事。你调整工作站，也开始规律活动。', {
    STR: 1,
    MNY: -1,
})
add(20311, '年终奖到账。你给自己留下一笔学习预算，其余部分存进了备用金。', {
    MNY: 2,
    INT: 1,
})
add(20312, '项目进入维护期。你下班后学做一道菜，发现生活里的成就感也很具体。', {
    SPR: 2,
    STR: 1,
})
add(
    20401,
    '你开始评估技术方案的长期成本。能维护、能交接，比“看上去很厉害”更重要。',
    { INT: 1, CHR: 1 },
)
add(
    20402,
    '团队遇到难题时会想到你。你给出排查路径，也给年轻同事留下思考的空间。',
    { CHR: 1, SPR: 1 },
)
add(
    20403,
    '你为内部工具做了性能优化。没有发布会，只有同事说了一句“今天顺多了”。',
    { INT: 1, SPR: 1 },
)
add(
    20404,
    '行业变化让岗位竞争更激烈。你重新梳理可迁移的能力，而非只记住工具用法。',
    { INT: 1, SPR: -1 },
)
add(
    20405,
    '你被邀请做一次公开分享。讲台上，你讲得最多的是踩坑经历和做过的取舍。',
    { CHR: 2, MNY: 1 },
    { include: 'INT>=17', grade: 1 },
)
add(
    20406,
    '客户续签了你的长期维护服务。稳定的信任，让收入多了一条来源。',
    { MNY: 3 },
    { include: 'EVT?[20309]', grade: 1 },
)
add(
    20407,
    '一个周末，你关掉工作群通知去爬山。项目仍在运行，你也可以暂时离线。',
    { STR: 2, SPR: 2 },
)
add(20408, '部门预算收紧。你砍掉了两个低价值需求，把有限精力留给重要的事情。', {
    CHR: 1,
    SPR: 1,
})
add(
    20409,
    '过去写的文档帮团队渡过人员交接。你没有出场，经验却仍然发挥了作用。',
    { CHR: 1, SPR: 2 },
)
add(20410, '本季平稳收官。你整理备份、更新依赖、记录收支，然后合上电脑。', {
    MNY: 2,
    STR: 1,
})
add(20004, '入职满一年，你参加了第一次年度评审。', undefined, {
    branch: [
        { condition: 'INT>=10', event: 20804 },
        { condition: 'AGE>=0', event: 20805 },
    ],
})
add(
    20804,
    '可靠的交付让你拿到晋升。新头衔带来更多责任，也带来了一点踏实的底气。',
    { MNY: 2, SPR: 2 },
    { NoRandom: true, grade: 1 },
)
add(
    20805,
    '评审反馈很具体：继续练好基本功。你选出一个需要补齐的方向，重新出发。',
    { INT: 2, SPR: 1 },
    { NoRandom: true },
)
add(
    20012,
    '三年节点，你开始认真思考：接下来想成为什么样的工程师？',
    undefined,
    {
        branch: [
            { condition: 'INT>=14', event: 20812 },
            { condition: 'CHR>=12', event: 20813 },
            { condition: 'AGE>=0', event: 20814 },
        ],
    },
)
add(
    20812,
    '你承担了核心模块的设计工作。技术路线渐渐清晰：把难题理解得更深一点。',
    { INT: 2, MNY: 2 },
    { NoRandom: true, grade: 2 },
)
add(
    20813,
    '你开始协调一个小团队。写代码之外，还要理解人、目标和交付之间的关系。',
    { CHR: 2, MNY: 2 },
    { NoRandom: true, grade: 2 },
)
add(
    20814,
    '你选择先稳住节奏。比起跟着别人赶路，你想把手里的工作做扎实。',
    { INT: 1, STR: 1, SPR: 2 },
    { NoRandom: true },
)
add(20024, '工作六年，你给自己的职业生涯做了一次中期复盘。', undefined, {
    branch: [
        { condition: 'MNY>=16', event: 20824 },
        { condition: '(STR>=10)&(SPR>=10)', event: 20825 },
        { condition: 'AGE>=0', event: 20826 },
    ],
})
add(
    20824,
    '备用金已经足够应对变化。拒绝不合适的机会，也是一种能力。',
    { SPR: 3 },
    { NoRandom: true, grade: 2 },
)
add(
    20825,
    '你找到了适合自己的节奏。稳定的作息和好奇心，让写代码变得可持续。',
    { STR: 1, SPR: 2 },
    { NoRandom: true, grade: 2 },
)
add(
    20826,
    '有些目标达到了，有些还没有。你决定减少无效比较，把精力放回可改变的事情。',
    { SPR: 2, STR: 1 },
    { NoRandom: true },
)
add(
    20036,
    '九年过去，你翻看最早的提交记录。当初的新人，已经走出了自己的职业路线。',
    undefined,
    {
        branch: [
            { condition: '(STR<=0)|(SPR<=0)', event: 20906 },
            { condition: 'INT>=30', event: 20901 },
            { condition: 'CHR>=26', event: 20902 },
            { condition: 'MNY>=26', event: 20903 },
            { condition: '(STR>=10)&(SPR>=12)', event: 20904 },
            { condition: 'AGE>=0', event: 20905 },
        ],
    },
)
for (const [id, ending] of endings) {
    add(
        id,
        `${ending.name}：${ending.description}`,
        { LIF: -1 },
        { NoRandom: true, grade: id === 20906 ? 0 : 2 },
    )
}
add(
    20700,
    '持续的透支已经影响到日常生活。你提交了休整申请，把恢复健康放在下一份工作之前。',
    undefined,
    {
        include: '(STR<=0)|(SPR<=0)',
        branch: [{ condition: 'AGE>=0', event: 20906 }],
    },
)
attachDecisions(items)
export const events = new Map(items.map((item) => [item.id, item]))
const stages = [
    items.filter((e) => e.id >= 20101 && e.id <= 20112),
    items.filter((e) => e.id >= 20201 && e.id <= 20214),
    items.filter((e) => e.id >= 20301 && e.id <= 20312),
    items.filter((e) => e.id >= 20401 && e.id <= 20410),
]
const milestones = new Map([
    [0, 20000],
    [1, 20001],
    [2, 20002],
    [3, 20003],
    [4, 20004],
    [6, 20006],
    [10, 20010],
    [12, 20012],
    [18, 20018],
    [24, 20024],
    [30, 20030],
    [36, 20036],
])
export const ages = new Map<number, Age>(
    Array.from({ length: CareerQuarters + 1 }, (_, age) => {
        const stage = age < 5 ? 0 : age < 13 ? 1 : age < 25 ? 2 : 3
        const milestone = milestones.get(age)
        const pool: [number, number][] = milestone
            ? [[milestone, 1]]
            : stages[stage]!.map((e) => [e.id, 1])
        // 后面的可用池覆盖前面的池，沿用原版引擎语义。
        return [age, { age, event: [pool, age > 0 ? [[20700, 1]] : []] }]
    }),
)

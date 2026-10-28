import type {
    Event,
    EventChoice,
    EventDialogue,
    EventEffect,
} from '../event.types'

/** 关键季度固定出现；结果事件 ID 同时充当后续剧情的经历标记。 */
export function attachDecisions(items: Event[]) {
    const outcome = (id: number, event: string, effect: EventEffect) => {
        items.push({ id, event, effect, grade: 1, NoRandom: true })
        return id
    }
    const scene = (
        id: number,
        event: string,
        dialogue: EventDialogue,
        choices: EventChoice[],
    ) => {
        const index = items.findIndex((item) => item.id === id)
        const original =
            index < 0 ? { id, event, grade: 0 as const } : items[index]!
        const next: Event = {
            ...original,
            event,
            branch: undefined,
            dialogue,
            choices,
        }
        if (index < 0) items.push(next)
        else items[index] = next
    }

    scene(
        20001,
        '第一份 Pull Request 收到了十几条修改意见。光标停在回复框里，你准备怎样回应？',
        {
            title: '你的第一次 Code Review',
            speaker: '林工',
            role: '技术导师',
            portrait: '林',
            text: '能跑只是第一步。这里有几处边界情况，我们可以一起看看。你想怎么处理？',
        },
        [
            {
                id: 'learn',
                label: '逐条理解，补上测试再提交',
                description: '先把基本功打稳，让这次评审成为一次学习。',
                event: outcome(
                    21001,
                    '你逐条回复了评审意见，并补齐边界测试。林工认真看完后点了 Merge。',
                    { INT: 2, SPR: 1 },
                ),
            },
            {
                id: 'discuss',
                label: '约一次讨论，讲清设计取舍',
                description: '不盲目照改，也不急着反驳，先理解彼此的理由。',
                event: outcome(
                    21002,
                    '你们在白板前讨论了二十分钟，找到了更清晰的实现。第一次协作就此建立。',
                    { CHR: 2, INT: 1 },
                ),
            },
            {
                id: 'rush',
                label: '先赶上线，之后再整理',
                description: '保住当前进度，但未补齐的边界可能会在以后找上门。',
                event: outcome(
                    21003,
                    '你带着待办注释合并了代码。进度暂时保住了，技术债也留在了仓库里。',
                    { MNY: 2, SPR: -1 },
                ),
            },
        ],
    )

    scene(
        20003,
        '熟悉工作以后，下班时间终于有了一点余地。你和搭档聊起下一步的安排。',
        {
            title: '下班后的两个小时',
            speaker: '小周',
            role: '同组搭档',
            portrait: '周',
            text: '最近总算没那么忙了。今晚你准备继续学点东西，还是给自己放个假？',
        },
        [
            {
                id: 'study',
                label: '买一本技术书，认真做完练习',
                description: '投入一点积蓄，积累可迁移的技术能力。',
                event: outcome(
                    21004,
                    '你选了一本基础书，边读边做小实验。知识开始从会用变成真正理解。',
                    { INT: 3, MNY: -1 },
                ),
            },
            {
                id: 'pair',
                label: '约同事交流，一起做个小项目',
                description: '在协作中学习，也把想法讲给别人听。',
                event: outcome(
                    21005,
                    '你和小周约定每周一起做点东西。有时卡住，换个人解释就豁然开朗。',
                    { INT: 1, CHR: 2 },
                ),
            },
            {
                id: 'rest',
                label: '关掉电脑，先把作息调整好',
                description: '恢复精力，让这份工作能够做得长久。',
                event: outcome(
                    21006,
                    '你把晚上的时间还给运动和睡眠。第二天醒来，脑子意外地清楚。',
                    { STR: 2, SPR: 2 },
                ),
            },
        ],
    )

    scene(
        20006,
        '周五晚饭刚端上桌，生产告警响了。群里发来一张持续上升的错误率曲线。',
        {
            title: '周五晚上的生产告警',
            speaker: '阿岑',
            role: '值班负责人',
            portrait: '岑',
            text: '我们需要尽快止损。你熟悉这个模块，是独立排查、拉人协作，还是先走回滚流程？',
        },
        [
            {
                id: 'hotfix',
                label: '接手排查，连夜修复根因',
                description: '用技术争取一次关键表现，也承担健康与心态的代价。',
                condition: 'INT>=9',
                lockedReason: '技术达到 9，才能独立处理',
                event: outcome(
                    21007,
                    '你锁定了并发问题，连夜修复并补上监控。业务恢复了，你也错过了整晚的休息。',
                    { INT: 3, MNY: 2, STR: -2, SPR: -1 },
                ),
            },
            {
                id: 'coordinate',
                label: '拉上值班同事，分工处理',
                description: '主动求援，用协作降低事故的影响。',
                event: outcome(
                    21008,
                    '你组织排查与回滚分工，和同事一起恢复了服务。复盘里，清晰的沟通得到认可。',
                    { CHR: 2, INT: 1, STR: -1 },
                ),
            },
            {
                id: 'rollback',
                label: '按预案回滚，把排查留到明天',
                description: '优先恢复服务，给团队保留休息和复盘的空间。',
                event: outcome(
                    21009,
                    '你们按应急预案完成回滚。周一再复盘根因，今晚没有人需要硬扛。',
                    { STR: 1, SPR: 2 },
                ),
            },
        ],
    )

    scene(
        20010,
        '一份新的工作机会摆到面前。待遇更好，技术栈也更陌生。',
        {
            title: '一封来自新团队的邀请',
            speaker: '陈顾问',
            role: '招聘顾问',
            portrait: '陈',
            text: '新岗位愿意给你更高的待遇，但也意味着重新适应团队。你想争取一下，还是先留在现在的项目？',
        },
        [
            {
                id: 'jump',
                label: '接受挑战，准备跳槽',
                description: '用已经积累的技术和表达能力，换一个新的环境。',
                condition: '(INT>=12)&(CHR>=8)',
                lockedReason: '需要技术 12、沟通 8',
                event: outcome(
                    21010,
                    '你顺利通过面试，加入了新的团队。待遇提高了，适应期也比想象中更忙。',
                    { MNY: 4, INT: 1, STR: -1 },
                ),
            },
            {
                id: 'stay',
                label: '留下来，把当前项目做深',
                description: '继续积累，完成一个真正熟悉的系统。',
                event: outcome(
                    21011,
                    '你婉拒了邀请，选择完成眼前的项目。导师开始让你参与更深的设计讨论。',
                    { INT: 2, CHR: 1, SPR: 1 },
                ),
            },
            {
                id: 'negotiate',
                label: '先和主管沟通职责与待遇',
                description: '主动表达诉求，为现有岗位争取更合适的安排。',
                condition: 'CHR>=10',
                lockedReason: '需要沟通达到 10',
                event: outcome(
                    21012,
                    '你用交付成果和明确诉求谈成了调整。涨幅没有新机会那么高，但节奏更适合自己。',
                    { MNY: 3, CHR: 1, SPR: 1 },
                ),
            },
        ],
    )

    scene(
        20012,
        '工作三年，技术负责人邀请你聊聊接下来的发展方向。',
        {
            title: '你想走哪条职业路线？',
            speaker: '周总',
            role: '技术负责人',
            portrait: '周',
            text: '你已经能独立交付了。接下来，可以深耕技术、试着带团队，也可以先保持现在的节奏。你更想要哪一种？',
        },
        [
            {
                id: 'technical',
                label: '深耕技术，争取负责核心模块',
                description: '走技术路线，这段经历会帮助你争取技术专家结局。',
                condition: 'INT>=12',
                lockedReason: '需要技术达到 12',
                event: 20812,
            },
            {
                id: 'lead',
                label: '试着带团队，让协作产生更大价值',
                description: '走管理路线，未来会更看重团队协作与沟通积累。',
                condition: 'CHR>=9',
                lockedReason: '需要沟通达到 9',
                event: 20813,
            },
            {
                id: 'steady',
                label: '先把工程能力做扎实，不急着定方向',
                description: '保留探索空间，也照顾好自己的状态。',
                event: 20814,
            },
        ],
    )

    scene(
        20018,
        '你关注的开源项目发来邀请。同一周，团队也在筹备下一次晋升评审。',
        {
            title: '工作之外的分支',
            speaker: '阿遥',
            role: '开源维护者',
            portrait: '遥',
            text: '之前的贡献很扎实。我们正好缺一位长期维护者，但它需要持续投入。你愿意试试吗？',
        },
        [
            {
                id: 'opensource',
                label: '加入维护，把时间投给开源',
                description: '投入储备与精力，换取更深的技术积累和社区连接。',
                event: outcome(
                    21016,
                    '你成为项目的协作维护者，开始认真处理 issue、评审补丁。作品也渐渐有了自己的声音。',
                    { INT: 3, CHR: 1, MNY: -2 },
                ),
            },
            {
                id: 'promotion',
                label: '暂缓邀请，先准备内部晋升',
                description: '把精力投入工作成果、职责和团队影响力。',
                event: outcome(
                    21017,
                    '你把已有成果整理成晋升材料，并开始主持跨组协作。责任更大，会议也更多了。',
                    { CHR: 3, MNY: 1, STR: -1 },
                ),
            },
            {
                id: 'recover',
                label: '两边都先放慢，给自己留一个假期',
                description: '机会还会有，恢复状态也是长期投入。',
                event: outcome(
                    21018,
                    '你认真拒绝了额外安排，用掉积攒的年假。回来时，对下一步反而更清楚了。',
                    { STR: 3, SPR: 3, MNY: -1 },
                ),
            },
        ],
    )

    const continued = items.findIndex((item) => item.id === 20824)
    items[continued] = {
        ...items[continued]!,
        event: '你决定继续在团队里深耕。经验、熟悉的伙伴和稳定交付，让这条路线值得再走一段。',
        effect: { INT: 2, MNY: 2, SPR: 1 },
    }
    scene(
        20024,
        '工作六年，你和一位老同事聊起职业与生活。',
        {
            title: '六年之后，为谁安排时间？',
            speaker: '阿远',
            role: '老同事',
            portrait: '远',
            text: '你有经验了，也比刚入行时更知道自己要什么。继续在团队里成长，尝试独立开发，还是把生活放在更前面？',
        },
        [
            {
                id: 'independent',
                label: '拿出一部分储备，试试独立开发',
                description:
                    '开启独立路线。未来可接长期项目，也会影响自由开发者结局。',
                condition: '(MNY>=12)&(INT>=14)',
                lockedReason: '需要积蓄 12、技术 14',
                event: outcome(
                    20827,
                    '你拿出一部分备用金，为独立产品留出试验期。工作开始围绕自己的作品和客户展开。',
                    { MNY: -4, INT: 1, SPR: 3 },
                ),
            },
            {
                id: 'balance',
                label: '收紧工作边界，认真经营生活',
                description: '以可持续为目标，争取生活架构师结局。',
                event: 20825,
            },
            {
                id: 'continue',
                label: '留在团队，继续争取有价值的项目',
                description:
                    '继续先前的技术或团队路线，保留熟悉环境里的成长空间。',
                event: 20824,
            },
        ],
    )

    scene(
        20030,
        '九年旅程逐渐进入尾声。你给自己留出一个下午，重新选择精力的去向。',
        {
            title: '下一段路，想留下什么？',
            speaker: '未来的你',
            role: '写给自己的便笺',
            portrait: '你',
            text: '过去已经积累了很多。最后这段时间，你想留下一个扎实的系统、一支更好的团队，还是一点从容生活的余地？',
        },
        [
            {
                id: 'specialize',
                label: '钻研一个难题，完成技术积累',
                description: '再深入一点，也接受这一季的精力消耗。',
                condition: 'INT>=18',
                lockedReason: '需要技术达到 18',
                event: outcome(
                    21022,
                    '你完成了长期想做的技术改进，并把设计取舍认真写进了文档。',
                    { INT: 3, STR: -1, SPR: -1 },
                ),
            },
            {
                id: 'mentor',
                label: '把经验交给新人，让团队自己成长',
                description: '把个人经验变成团队能够继续使用的方法。',
                event: outcome(
                    21023,
                    '你花时间带新人、补文档。某天你休假时，团队自己处理好了一个棘手的问题。',
                    { CHR: 3, SPR: 1 },
                ),
            },
            {
                id: 'clients',
                label: '经营长期客户，稳住独立业务',
                description: '为已经选择的独立路线建立更可靠的收入来源。',
                condition: 'EVT?[20827]',
                lockedReason: '需要先选择独立开发路线',
                event: outcome(
                    21024,
                    '你把一次性交付变成长期维护服务，客户愿意为稳定与信任继续续约。',
                    { MNY: 3, SPR: 2 },
                ),
            },
            {
                id: 'life',
                label: '减少额外安排，把时间留给生活',
                description: '成长也包括知道什么时候可以停下来。',
                event: outcome(
                    21025,
                    '你准时合上电脑，把一个平常的周末过得很认真。生活没有等待你完成所有待办。',
                    { STR: 2, SPR: 3, MNY: -1 },
                ),
            },
        ],
    )

    items.push({
        id: 20213,
        event: '当初赶着合并的边界遗漏在联调中暴露。你花时间补齐测试，给技术债做了一个真正的收尾。',
        grade: 0,
        include: 'EVT?[21003]',
        exclude: 'EVT?[20213]',
        effect: { INT: 1, STR: -1, SPR: -1 },
    })
    items.push({
        id: 20214,
        event: '之前补上的边界测试拦住了一次回归。评审时多花的时间，今天替团队省了下来。',
        grade: 1,
        include: 'EVT?[21001]',
        exclude: 'EVT?[20214]',
        effect: { INT: 1, SPR: 2 },
    })
    const finale = items.findIndex((item) => item.id === 20036)
    const old = items[finale]!
    items[finale] = {
        ...old,
        branch: [
            old.branch![0]!,
            { condition: '(EVT?[20827])&(MNY>=16)', event: 20903 },
            { condition: '(EVT?[20825])&(STR>=10)&(SPR>=12)', event: 20904 },
            { condition: '(EVT?[20813])&(CHR>=22)', event: 20902 },
            { condition: '(EVT?[20812])&(INT>=26)', event: 20901 },
            ...old.branch!.slice(1),
        ],
    }
}

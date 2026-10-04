// Edit this file to customise the words on your site. Nothing here touches game logic.

export const siteContent = {
  name: 'Bradley France',
  tagline: 'Full Stack Developer',

  about: {
    title: 'About Me',
    body: [
      "Hi, I'm Bradley, a full stack developer who's deeply passionate about technology and always " +
        'looking for the next thing to learn. Outside of work and formal education, I build home ' +
        'projects to explore and master new languages, from Python and Java to C# and JavaScript.',
      'I run a small web design and hosting company as a weekend side project, handling client sites, ' +
        'server infrastructure and bespoke development end to end. I also come from a network and ' +
        'infrastructure background: building computers, running my own cabling, and getting hands-on ' +
        'with Cisco switches, Active Directory and VMware along the way.',
      'Outside of tech: classic gaming (long-time Old School RuneScape player), a broad taste in music ' +
        "from old-school rap to 60s rock, and I've previously played ice hockey and done airsoft.",
    ],
  },

  cv: {
    title: 'CV / Resume',
    downloadUrl: '/cv.pdf',
    experience: [
      {
        role: 'Full Stack Developer, US Website Team',
        company: 'Cyncly',
        period: '2022 - Present',
        details:
          'Selected to join the US-based web engineering division, contributing to a large-scale platform ' +
          'built within a monorepo architecture spanning CMS, ERP and other business-critical systems used ' +
          'across international markets. Develop and maintain backend services in TypeScript, Node.js and ' +
          'NestJS, and responsive front-ends in React, with additional backend integrations in C#. Work ' +
          'within Docker containerised environments for consistent development, testing and deployment, ' +
          'support architectural improvements around modularisation and performance, integrate data flow ' +
          'between CMS/ERP/internal systems, and take part in code review, sprint planning and agile delivery.',
      },
      {
        role: 'Software Developer & eStore Specialist',
        company: 'Cyncly',
        period: '2022 - Present',
        details:
          'Senior technical lead for the development, stability and security of a high-traffic custom CMS ' +
          '(PHP, JavaScript, MySQL) in a demanding eCommerce environment, with a strong emphasis on API ' +
          'development and third-party integrations. Also manages the Azure-hosted Linux (CentOS) ' +
          'infrastructure: patch management, performance tuning, monitoring/alerting and backup strategy, ' +
          'CI/CD pipelines in Azure DevOps, and firewall/DNS/mail server configuration. Maintains PCI DSS ' +
          'and GDPR compliance through security audits and coordination with external penetration testers, ' +
          'and delivered over £45,000 in annual infrastructure cost savings through server consolidation.',
      },
      {
        role: 'Technical Support & Infrastructure Engineer',
        company: '20i',
        period: 'Aug 2021 - Jul 2022',
        details:
          'Key member of a 24/7 hosting support operation on the night-shift team, with root access to ' +
          'resolve complex issues directly rather than just triage them: diagnosing site errors, server-side ' +
          'interventions, and using BASH for IP-based firewall rules, security log investigation, CDN cache ' +
          'purges and automation scripts. Managed and troubleshot MySQL databases (queries, optimisation, ' +
          'data recovery), investigated REST API failures affecting renewals and payment processing, and ' +
          'monitored infrastructure and network health with tools including Nagios. Also handled email ' +
          'service configuration (SMTP/IMAP/spam filtering), domain and SSL renewals, server migrations, and ' +
          'authored technical guides for the internal support knowledge base.',
      },
      {
        role: 'Data Infrastructure Engineer',
        company: 'Phoenix Networks',
        period: 'Jan 2021 - Aug 2021',
        details:
          'Field-based role deploying network and security systems on client sites end to end: racking and ' +
          'stacking hardware, running and terminating copper and fibre optic cabling, and basic fibre ' +
          'splicing. Configured Cisco switches and routers to establish LANs, and installed and programmed ' +
          'Paxton access control systems and Hikvision CCTV networks, including user groups, permission ' +
          'tiers and client-specific security parameters. Used Excel extensively for hardware inventory, ' +
          'asset tracking and site-specific configuration planning.',
      },
    ],
    skills: [
      'TypeScript',
      'Node.js',
      'NestJS',
      'React',
      'C#',
      'PHP',
      'MySQL',
      'Docker',
      'Azure / Azure DevOps',
      'Linux (CentOS)',
      'BASH',
      'REST APIs',
      'Cisco Networking',
      'Active Directory',
      'VMware',
      'PCI DSS / GDPR Compliance',
    ],
  },

  projects: {
    title: 'Projects',
    items: [
      {
        name: 'HostWithUs247 - Web Design & Hosting',
        description:
          'A web design and hosting business I run, covering client sites, server infrastructure and ' +
          'bespoke development handled end to end.',
        link: 'https://www.hostwithus247.co.uk',
        tags: ['PHP', 'Hosting', 'Client Work'],
      },
      {
        name: 'This Village (source on GitHub)',
        description:
          'The retro portfolio site you are standing in right now, built with Three.js and TypeScript.',
        link: 'https://github.com/Bradd101/portfolio-village',
        tags: ['TypeScript', 'Three.js'],
      },
    ],
  },

  // RuneScape-style skill levels (1-99) for the Skills tab, purely for flavour.
  // Max level is 99, same as the game. A few joke "hobby" skills are mixed in
  // alongside the real tech stack, same way OSRS mixes combat/gathering/artisan skills.
  skillLevels: [
    { name: 'TypeScript', level: 99, color: '#3178c6' },
    { name: 'Node.js', level: 99, color: '#5fa04e' },
    { name: 'React', level: 95, color: '#61dafb' },
    { name: 'NestJS', level: 90, color: '#e0234e' },
    { name: 'C#', level: 85, color: '#9b4f96' },
    { name: 'PHP', level: 92, color: '#787cb5' },
    { name: 'MySQL', level: 88, color: '#4479a1' },
    { name: 'Docker', level: 80, color: '#2496ed' },
    { name: 'Azure', level: 85, color: '#0078d4' },
    { name: 'Linux', level: 90, color: '#f0b94a' },
    { name: 'BASH', level: 88, color: '#4eaa25' },
    { name: 'REST APIs', level: 95, color: '#e58b3c' },
    { name: 'PCI DSS / GDPR', level: 80, color: '#d4af6a' },
    { name: 'Woodcutting', level: 56, color: '#4e8b3a' },
    { name: 'Fishing', level: 61, color: '#3b6ea5' },
    { name: 'Firemaking', level: 49, color: '#d9641e' },
    { name: 'Cooking', level: 3, color: '#a7392b' },
  ],

  contact: {
    title: 'Contact',
    email: 'francebradley101@hotmail.co.uk',
    links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/bradley-france-477280231' }],
  },
};

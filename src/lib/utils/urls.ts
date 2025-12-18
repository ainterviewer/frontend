export function parseProjectRoute(pathname: string) {
    const parts = pathname.split('/');
    const projectsIndex = parts.indexOf('projects');
    let projectId: string | undefined;
    let languageCode: string | undefined;

    if (projectsIndex > -1 && parts.length > projectsIndex + 1) {
        projectId = parts[projectsIndex + 1];

        const nextPart = parts[projectsIndex + 2];
        if (nextPart && nextPart.length === 2) {
            languageCode = nextPart;
        }
    }

    return { projectId, languageCode };
}

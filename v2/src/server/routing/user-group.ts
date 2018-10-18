import * as express from 'express';
import { TwitterUserService } from '../models/twitter-service';
import { UserGroupPathFormat } from '../models/user-group';
import { requireAuthMiddleware } from './auth';
import { asyncMiddleware, middleware } from './index';
import { createTwitterUserService } from './tweet';

const fetchEdit = async (slug: string, tus: TwitterUserService) => {
  let source;
  if (slug !== undefined) {
    source = await tus.exportUserGroup(slug);
  }

  return {
    title: 'Edit User Group',
    slug,
    userGroupPathPattern: UserGroupPathFormat.regexpPattern,
    source: source || '',
  };
};

export const userGroupRouter = () => {
  const router = express.Router();

  router.all('*', requireAuthMiddleware);

  router.get('/', middleware((request, response, next) => {
    response.render('user-group-index', {
      title: 'User Group Management',
      _csrf: request.csrfToken(),
    });
  }));

  router.get('/edit', asyncMiddleware(async (request, response, next) => {
    const slug = (request.query || {}).slug || '';
    const tus = createTwitterUserService(request);
    const bag = await fetchEdit(slug, tus);

    response.render('user-group-edit', {
      title: bag.title,
      status: '',
      bag,
      _csrf: request.csrfToken(),
    });
  }));

  router.post('/edit', asyncMiddleware(async (request, response, next) => {
    const slug = request.body.slug || undefined;
    const source = request.body.source || undefined;

    if (slug === undefined || source === undefined) {
      throw new Error('Invalid request.');
    }

    const tus = createTwitterUserService(request);
    await tus.importUserGroup(slug, source);

    const bag = await fetchEdit(slug, tus);
    response.render('user-group-edit', {
      title: 'Edit User Group',
      status: 'success',
      bag,
      _csrf: request.csrfToken(),
    });
  }));

  router.get('/all', asyncMiddleware(async (request, response, next) => {
    const tus = createTwitterUserService(request);
    const userGroups = await tus.allUserGroups();

    response.render('user-group-all', {
      title: 'Owned User Groups',
      userGroups:
        userGroups.map(userGroup => ({
          path: userGroup.path,
          slug: userGroup.userGroupKey.slug,
        })),
      _csrf: request.csrfToken(),
    });
  }));

  return router;
};

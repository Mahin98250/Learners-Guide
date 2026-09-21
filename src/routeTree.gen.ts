/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
// Generated TanStack Router route tree.

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AppRouteImport } from './routes/app'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as AdminRouteImport } from './routes/admin'
import { Route as ResetPasswordRouteImport } from './routes/reset-password'
import { Route as OwnerRouteImport } from './routes/owner'
import { Route as OwnerRouteImport } from './routes/owner'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const AppRoute = AppRouteImport.update({ id: '/app', path: '/app', getParentRoute: () => rootRouteImport } as any)
const AuthRoute = AuthRouteImport.update({ id: '/auth', path: '/auth', getParentRoute: () => rootRouteImport } as any)
const AdminRoute = AdminRouteImport.update({ id: '/admin', path: '/admin', getParentRoute: () => rootRouteImport } as any)
const ResetPasswordRoute = ResetPasswordRouteImport.update({ id: '/reset-password', path: '/reset-password', getParentRoute: () => rootRouteImport } as any)
const OwnerRoute = OwnerRouteImport.update({ id: '/owner', path: '/owner', getParentRoute: () => rootRouteImport } as any)
const OwnerRoute = OwnerRouteImport.update({ id: '/owner', path: '/owner', getParentRoute: () => rootRouteImport } as any)

export interface FileRoutesByFullPath { '/': typeof IndexRoute; '/app': typeof AppRoute; '/auth': typeof AuthRoute; '/admin': typeof AdminRoute; '/reset-password': typeof ResetPasswordRoute; '/owner': typeof OwnerRoute }
export interface FileRoutesByTo { '/': typeof IndexRoute; '/app': typeof AppRoute; '/auth': typeof AuthRoute; '/admin': typeof AdminRoute; '/reset-password': typeof ResetPasswordRoute; '/owner': typeof OwnerRoute }
export interface FileRoutesById { __root__: typeof rootRouteImport; '/': typeof IndexRoute; '/app': typeof AppRoute; '/auth': typeof AuthRoute; '/admin': typeof AdminRoute; '/reset-password': typeof ResetPasswordRoute; '/owner': typeof OwnerRoute }
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/app' | '/auth' | '/admin' | '/reset-password' | '/owner'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/app' | '/auth' | '/admin' | '/reset-password' | '/owner'
  id: '__root__' | '/' | '/app' | '/auth' | '/admin' | '/reset-password' | '/owner'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren { IndexRoute: typeof IndexRoute; AppRoute: typeof AppRoute; AuthRoute: typeof AuthRoute; AdminRoute: typeof AdminRoute; ResetPasswordRoute: typeof ResetPasswordRoute; OwnerRoute: typeof OwnerRoute }

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }
    '/app': { id: '/app'; path: '/app'; fullPath: '/app'; preLoaderRoute: typeof AppRouteImport; parentRoute: typeof rootRouteImport }
    '/auth': { id: '/auth'; path: '/auth'; fullPath: '/auth'; preLoaderRoute: typeof AuthRouteImport; parentRoute: typeof rootRouteImport }
    '/admin': { id: '/admin'; path: '/admin'; fullPath: '/admin'; preLoaderRoute: typeof AdminRouteImport; parentRoute: typeof rootRouteImport }
    '/reset-password': { id: '/reset-password'; path: '/reset-password'; fullPath: '/reset-password'; preLoaderRoute: typeof ResetPasswordRouteImport; parentRoute: typeof rootRouteImport }
    '/owner': { id: '/owner'; path: '/owner'; fullPath: '/owner'; preLoaderRoute: typeof OwnerRouteImport; parentRoute: typeof rootRouteImport }
    '/owner': { id: '/owner'; path: '/owner'; fullPath: '/owner'; preLoaderRoute: typeof OwnerRouteImport; parentRoute: typeof rootRouteImport }
  }
}

const rootRouteChildren: RootRouteChildren = { IndexRoute, AppRoute, AuthRoute, AdminRoute, ResetPasswordRoute, OwnerRoute }
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

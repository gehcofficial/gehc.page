import React from 'react';
import { HashRouter } from 'react-router-dom';

/** Bridges React Router hash history with existing AppContext hash sync */
export const AppHashRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HashRouter>{children}</HashRouter>
);

import React from 'react';
import PropTypes from 'prop-types';
import Switch from 'react-router-dom/Switch';
import Route from 'react-router-dom/Route';
import { hot } from 'react-hot-loader';
import ScanRoute from './routes/ScanRoute';

const ScanRoot = ({ match: { path } }) => (
  <Switch>
    <Route
      path={path}
      exact
      component={ScanRoute}
    />
  </Switch>
);

ScanRoot.propTypes = {
  match: PropTypes.shape({
    path: PropTypes.string
  }).isRequired
};

export default hot(module)(ScanRoot);

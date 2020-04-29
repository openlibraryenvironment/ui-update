import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Headline, KeyValue } from '@folio/stripes/components';
import { CatalogInfo, RequesterSupplier } from '@folio/stripes-reshare/cards';

const SelectedRequest = ({ request }) => (
  <>
    <KeyValue label={<FormattedMessage id="stripes-reshare.requestState" />}>
      <Headline size="large" faded><FormattedMessage id={`stripes-reshare.states.${request.state?.code}`} /></Headline>
    </KeyValue>
    <CatalogInfo request={request} />
    <RequesterSupplier request={request} />
  </>
);

SelectedRequest.propTypes = {
  request: PropTypes.object.isRequired,
};

export default SelectedRequest;

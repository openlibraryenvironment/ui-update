import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Headline, KeyValue } from '@folio/stripes/components';
import { useOkapiQuery } from '@reshare/stripes-reshare';
import { CatalogInfo, RequesterSupplier } from '@reshare/stripes-reshare/cards';

const SelectedRequest = ({ initialRequest, initialRequestTime }) => {
  const q = useOkapiQuery(`rs/patronrequests/${initialRequest.id}`, {
    initialData: initialRequest,
    initialDataUpdatedAt: initialRequestTime,
    staleTime: 2 * 60 * 1000,
  });
  const request = q.data;

  return (
    <>
      <KeyValue label={<FormattedMessage id="stripes-reshare.requestState" />}>
        <Headline size="large" faded><FormattedMessage id={`stripes-reshare.states.${request.state?.code}`} /></Headline>
      </KeyValue>
      <CatalogInfo request={request} />
      <RequesterSupplier request={request} />
    </>
  );
};

export default SelectedRequest;
